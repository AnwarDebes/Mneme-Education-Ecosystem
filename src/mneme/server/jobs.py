"""In-memory job registry.

Mneme's pipeline is synchronous and long-running per file (an LLM run
takes seconds to minutes). The server runs each job in a background
thread; the registry tracks state so the SSE endpoint can stream
progress and the REST endpoints can return current status.

For v0.1 we keep the registry in process memory. A production
deployment can swap this for Redis or sqlite by re-implementing the
same handful of methods.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from ..config import Config
from ..extraction.loader import detect_kind
from ..pipeline import Pipeline
from ..types import Source
from .models import CardOut, JobConfig, JobDetail, JobStatus, StageEvent

log = logging.getLogger("mneme.server.jobs")


# Map pipeline-stage names to JobStatus enum values.
_STAGE_TO_STATUS = {
    "load": JobStatus.LOADING,
    "chunk": JobStatus.CHUNKING,
    "extract_facts": JobStatus.EXTRACTING_FACTS,
    "generate_cards": JobStatus.GENERATING_CARDS,
    "quality_filter": JobStatus.FILTERING,
    "deduplicate": JobStatus.DEDUPLICATING,
    "difficulty": JobStatus.SCORING_DIFFICULTY,
    "write_anki": JobStatus.WRITING_DECK,
}


class _Job:
    """Per-job state held in memory."""

    def __init__(self, job_id: str, filename: str, file_path: Path, config: JobConfig) -> None:
        self.id = job_id
        self.filename = filename
        self.file_path = file_path
        self.config = config
        self.status: JobStatus = JobStatus.PENDING
        self.created_at = datetime.utcnow()
        self.finished_at: datetime | None = None
        self.events: list[StageEvent] = []
        self.cards: list[CardOut] = []
        self.error: str | None = None
        self.apkg_path: str | None = None
        self.n_chunks = 0
        self.n_facts = 0

        # Event queue used by the SSE endpoint. Each subscriber gets a
        # fresh queue with the existing event history replayed first.
        self._subscribers: list[asyncio.Queue[StageEvent | None]] = []
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def push_event(self, event: StageEvent) -> None:
        """Append an event and broadcast to all SSE subscribers."""
        with self._lock:
            self.events.append(event)
            self.status = event.stage
            subscribers = list(self._subscribers)
        for q in subscribers:
            if self._loop is None:
                continue
            self._loop.call_soon_threadsafe(q.put_nowait, event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            # Replay history so a late subscriber sees prior stages.
            for evt in self.events:
                q.put_nowait(evt)
            self._subscribers.append(q)
            if self.status in {JobStatus.DONE, JobStatus.ERROR}:
                q.put_nowait(None)
        return q

    def to_detail(self) -> JobDetail:
        return JobDetail(
            id=self.id,
            filename=self.filename,
            status=self.status,
            created_at=self.created_at,
            finished_at=self.finished_at,
            config=self.config,
            n_chunks=self.n_chunks,
            n_facts=self.n_facts,
            n_cards=len(self.cards),
            cards=self.cards,
            events=self.events,
            apkg_path=self.apkg_path,
            error=self.error,
        )

    def signal_finished(self) -> None:
        self.finished_at = datetime.utcnow()
        if self._loop is None:
            return
        with self._lock:
            subscribers = list(self._subscribers)
        for q in subscribers:
            self._loop.call_soon_threadsafe(q.put_nowait, None)


class JobRegistry:
    """Holds every active job in process memory and orchestrates background runs."""

    def __init__(self, upload_dir: Path) -> None:
        self.upload_dir = upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, _Job] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def create(self, filename: str, file_bytes: bytes, config: JobConfig) -> _Job:
        job_id = uuid.uuid4().hex[:12]
        path = self.upload_dir / f"{job_id}_{_safe_filename(filename)}"
        path.write_bytes(file_bytes)
        job = _Job(job_id, filename, path, config)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def register_imported(
        self,
        filename: str,
        config: JobConfig,
        cards: list[CardOut],
    ) -> _Job:
        """Create a job that's already done, holding pre-built cards.

        Used by the import endpoints (.apkg, CSV/TSV, JSON). The cards
        are stored verbatim; no pipeline run happens. ``apkg_path`` stays
        ``None`` because we don't synthesize one for imports.
        """
        job_id = uuid.uuid4().hex[:12]
        path = self.upload_dir / f"{job_id}_{_safe_filename(filename)}"
        # Empty placeholder so file existence checks elsewhere don't crash.
        path.write_text(f"imported deck: {filename}\n", encoding="utf-8")
        job = _Job(job_id, filename, path, config)
        job.cards = list(cards)
        job.status = JobStatus.DONE
        job.finished_at = datetime.utcnow()
        job.n_facts = len({c.source_fact or "" for c in cards if c.source_fact})
        job.events.append(
            StageEvent(
                stage=JobStatus.DONE,
                message=f"imported {len(cards)} cards",
                outputs=len(cards),
                elapsed_seconds=0.0,
            ),
        )
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> _Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self) -> list[_Job]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    def remove(self, job_id: str) -> bool:
        """Drop a job from memory and best-effort delete its uploaded file
        + generated .apkg. Returns False if the id is unknown."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is None:
            return False
        # Wake every SSE subscriber so they don't block forever.
        try:
            job.signal_finished()
        except Exception:
            log.exception("error signalling subscribers during remove")
        for p in (job.file_path, Path(job.apkg_path) if job.apkg_path else None):
            if p and p.exists():
                try:
                    p.unlink()
                except OSError:
                    log.warning("could not unlink %s", p)
        return True

    def run_in_background(self, job: _Job, loop: asyncio.AbstractEventLoop) -> None:
        job.attach_loop(loop)
        threading.Thread(target=self._run_job, args=(job,), daemon=True).start()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _run_job(self, job: _Job) -> None:
        try:
            self._run_job_inner(job)
        except Exception as exc:
            log.exception("job %s crashed", job.id)
            job.error = str(exc)
            job.push_event(StageEvent(stage=JobStatus.ERROR, message=str(exc)))
            job.status = JobStatus.ERROR
        finally:
            job.signal_finished()

    def _run_job_inner(self, job: _Job) -> None:
        config = Config()
        config.llm.model = job.config.model
        config.llm.base_url = job.config.base_url
        if job.config.seed is not None:
            config.llm.seed = job.config.seed
        config.generator.max_facts_per_chunk = job.config.max_facts_per_chunk
        config.generator.max_cards_per_fact = job.config.max_cards_per_fact
        config.embedding.dedup_threshold = job.config.dedup_threshold
        config.difficulty.backend = job.config.difficulty_backend
        config.anki.use_ankiconnect = False
        config.anki.deck_name = job.config.deck_name or job.filename.rsplit(".", 1)[0]
        apkg_path = self.upload_dir / f"{job.id}.apkg"
        config.anki.apkg_export_path = str(apkg_path)

        # Build a Pipeline whose stage callback pushes SSE events.
        pipeline = _instrumented_pipeline(config, job)
        kind = detect_kind(str(job.file_path))
        source = Source(kind=kind, path=str(job.file_path), title=job.filename)

        t0 = time.time()
        summary = pipeline.run(source)
        elapsed = time.time() - t0

        # Final stage event so the SSE stream emits a terminal frame.
        job.apkg_path = summary.apkg_path
        job.push_event(
            StageEvent(
                stage=JobStatus.DONE,
                message=f"emitted {summary.cards_emitted} cards in {elapsed:.1f}s",
                inputs=0,
                outputs=summary.cards_emitted,
                elapsed_seconds=elapsed,
            )
        )
        job.status = JobStatus.DONE


def _instrumented_pipeline(config: Config, job: _Job) -> Pipeline:
    """Return a Pipeline wired to push StageEvent objects to the job."""
    pipeline = Pipeline(config)

    original_stage = pipeline._stage

    def stage_with_events(name: str, action, summary, *, inputs: int = 0, output_count: int | None = None):
        status = _STAGE_TO_STATUS.get(name, JobStatus.PENDING)
        job.push_event(StageEvent(stage=status, message=f"{name} started", inputs=inputs))
        result = original_stage(name, action, summary, inputs=inputs, output_count=output_count)
        # Pull the stat row the original stage appended.
        last = summary.stages[-1]
        job.push_event(
            StageEvent(
                stage=status,
                message=f"{name} done",
                inputs=last.inputs,
                outputs=last.outputs,
                elapsed_seconds=last.elapsed_seconds,
            )
        )
        # Cache counts on the job for the summary endpoint.
        if name == "chunk":
            job.n_chunks = last.outputs
        if name == "extract_facts":
            job.n_facts = last.outputs
        if name == "generate_cards":
            from .app import _card_to_out  # avoid import cycle at module load

            job.cards = [_card_to_out(c) for c in (result or [])]
        if name in {"quality_filter", "deduplicate", "difficulty"}:
            from .app import _card_to_out

            job.cards = [_card_to_out(c) for c in (result or [])]
        return result

    pipeline._stage = stage_with_events  # type: ignore[method-assign]
    return pipeline


def _safe_filename(name: str) -> str:
    keep = "".join(c if c.isalnum() or c in (" ", "_", "-", ".") else "_" for c in name)
    return keep.strip().replace(" ", "_") or "upload"
