"""High-level pipeline orchestrator.

The :class:`Pipeline` wires the seven stages together:

  source -> chunks -> facts -> cards -> quality-filter -> dedup -> difficulty -> Anki

Each stage's input and output are validated Pydantic models, so a
broken intermediate step throws at the boundary and the rest of the
pipeline does not run on garbage.

Backends (LLM, embedding, difficulty, Anki) are injected via the
constructor so the same pipeline class is used in production runs,
in unit tests (with :class:`MockBackend`), and in benchmarks.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

from .anki.ankiconnect import AnkiConnectClient, AnkiConnectError
from .anki.apkg import ApkgExporter
from .anki.templates import template_for_name
from .cards.deduplicate import Deduplicator
from .cards.generator import CardGenerator, FactExtractor
from .cards.quality import QualityFilter
from .config import Config
from .difficulty.selector import build_difficulty_classifier
from .embedding.selector import build_embedding_backend
from .extraction.chunker import Chunker
from .extraction.loader import load_source
from .llm.backend import LLMBackend
from .llm.cache import CachedLLMBackend
from .llm.ollama_backend import OllamaBackend
from .llm.prompts import PROMPT_VERSION, prompt_provenance
from .types import Card, RunSummary, Source, StageStat

log = logging.getLogger(__name__)


class Pipeline:
    """End-to-end mneme pipeline.

    Parameters
    ----------
    config : Config
        All knobs. See :class:`mneme.config.Config`.
    llm : LLMBackend, optional
        Defaults to :class:`OllamaBackend` constructed from ``config.llm``.
        Pass a :class:`MockBackend` (or any object exposing ``complete``)
        for tests.
    embedding_backend : optional
        Pass to override the embedding backend selected by
        :func:`build_embedding_backend`.
    difficulty_classifier : optional
        Pass to override the difficulty classifier selected by
        :func:`build_difficulty_classifier`.
    """

    def __init__(
        self,
        config: Config,
        llm: LLMBackend | None = None,
        embedding_backend=None,
        difficulty_classifier=None,
    ) -> None:
        self.config = config
        if llm is not None:
            # The user injected a backend explicitly; trust them. If they
            # want caching they can wrap it themselves with CachedLLMBackend.
            self.llm: LLMBackend = llm
        else:
            inner: LLMBackend = OllamaBackend(config.llm)
            if config.llm.cache_enabled:
                self.llm = CachedLLMBackend(
                    inner,
                    cache_dir=config.cache_dir,
                    prompt_version=PROMPT_VERSION,
                    model=config.llm.model,
                    seed=config.llm.seed,
                    default_temperature=config.llm.temperature,
                )
                log.info(
                    "LLM cache enabled at %s (prompt v%s)",
                    config.cache_dir,
                    PROMPT_VERSION,
                )
            else:
                self.llm = inner
        self.chunker = Chunker(config.chunker)
        self.fact_extractor = FactExtractor(self.llm, config.generator)
        self.card_generator = CardGenerator(self.llm, config.generator)
        self.quality_filter = QualityFilter(config.quality)
        self.embedding_backend = embedding_backend or build_embedding_backend(config.embedding)
        self.deduplicator = Deduplicator(self.embedding_backend, config.embedding) if self.embedding_backend else None
        self.difficulty_classifier = difficulty_classifier or build_difficulty_classifier(config.difficulty)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def estimate(self, source: Source) -> dict:
        """Return an upper-bound cost estimate without calling the LLM.

        Runs the cheap stages (load + chunk) and projects the LLM call
        count and elapsed time from the chunker output and the
        :class:`GeneratorConfig` knobs. The wall-clock estimate uses a
        conservative 3 seconds per LLM call, which is roughly what
        ``qwen2.5:7b-instruct`` averages on a recent consumer GPU; CPU
        runs will be slower, larger models will be slower per call.
        """
        text = load_source(source)
        chunks = self.chunker.chunk(text)
        n_chunks = len(chunks)
        gen = self.config.generator
        max_facts_total = n_chunks * gen.max_facts_per_chunk
        max_cards_total = max_facts_total * gen.max_cards_per_fact
        llm_calls = n_chunks + max_facts_total  # 1 facts call + 1 card call per fact
        seconds_per_call = 3.0
        estimated_seconds = llm_calls * seconds_per_call
        return {
            "chunks": n_chunks,
            "characters": len(text),
            "max_atomic_facts": max_facts_total,
            "max_cards": max_cards_total,
            "estimated_llm_calls_upper_bound": llm_calls,
            "estimated_seconds_at_3s_per_call": round(estimated_seconds, 1),
            "estimated_minutes_at_3s_per_call": round(estimated_seconds / 60.0, 1),
        }

    def run(self, source: Source) -> RunSummary:
        """Run the full pipeline on one source and return a :class:`RunSummary`."""
        from . import __version__

        summary = RunSummary(
            mneme_version=__version__,
            source=source,
            config_snapshot=self.config.model_dump(mode="json"),
        )

        text = self._stage("load", lambda: load_source(source), summary, output_count=1)
        chunks = self._stage("chunk", lambda: self.chunker.chunk(text), summary)
        # Pre-flight estimate logged after chunking so the user sees the
        # ceiling on LLM cost before the slow stages start. The actual
        # cost is usually 30-60% of this number because the LLM rarely
        # returns the maximum allowed facts/cards.
        gen = self.config.generator
        max_facts_total = len(chunks) * gen.max_facts_per_chunk
        max_cards_total = max_facts_total * gen.max_cards_per_fact
        upper_calls = len(chunks) + max_facts_total
        log.info(
            "pre-flight: %d chunks -> up to %d facts -> up to %d cards (~%d LLM calls)",
            len(chunks),
            max_facts_total,
            max_cards_total,
            upper_calls,
        )
        facts = self._stage("extract_facts", lambda: self.fact_extractor.extract(chunks), summary, inputs=len(chunks))
        cards = self._stage("generate_cards", lambda: self.card_generator.generate(facts), summary, inputs=len(facts))
        cards = self._stage("quality_filter", lambda: self.quality_filter.filter(cards), summary, inputs=len(cards))
        if self.deduplicator is not None:
            cards = self._stage("deduplicate", lambda: self.deduplicator.dedup(cards), summary, inputs=len(cards))
        if self.difficulty_classifier is not None:
            cards = self._stage("difficulty", lambda: self.difficulty_classifier.score_many(cards), summary, inputs=len(cards))

        summary.cards_emitted = len(cards)

        # Write Anki output.
        deck_name = self.config.anki.deck_name or self._default_deck_name(source)
        summary.deck_name = deck_name
        self._write_anki(cards, deck_name, summary)

        summary.stages.append(
            StageStat(
                name="provenance",
                inputs=0,
                outputs=0,
                elapsed_seconds=0.0,
                notes=str(prompt_provenance()),
            )
        )
        from datetime import datetime, timezone

        summary.ended_at = datetime.now(timezone.utc)
        log.info("done: emitted %d cards into deck %r", summary.cards_emitted, deck_name)
        return summary

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _stage(self, name, action, summary: RunSummary, *, inputs: int = 0, output_count: int | None = None):
        t0 = time.perf_counter()
        try:
            result = action()
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            summary.stages.append(
                StageStat(name=name, inputs=inputs, outputs=0, elapsed_seconds=elapsed, notes=f"error: {exc}")
            )
            raise
        elapsed = time.perf_counter() - t0
        if output_count is None:
            try:
                output_count = len(result)
            except TypeError:
                output_count = 1
        summary.stages.append(
            StageStat(name=name, inputs=inputs, outputs=output_count, elapsed_seconds=elapsed)
        )
        log.info("stage %s: %d -> %d (%.2fs)", name, inputs, output_count, elapsed)
        return result

    def _write_anki(self, cards: list[Card], deck_name: str, summary: RunSummary) -> None:
        t0 = time.perf_counter()
        wrote_via = None
        note_ids: list[int] = []
        if self.config.anki.use_ankiconnect:
            client = AnkiConnectClient(self.config.anki)
            if client.ping():
                try:
                    note_ids = client.add_cards(cards, deck_name)
                    wrote_via = "ankiconnect"
                except AnkiConnectError as exc:
                    log.warning("AnkiConnect rejected push (%s); falling back to .apkg", exc)
            else:
                log.warning("AnkiConnect unreachable; falling back to .apkg")
        apkg_path = self.config.anki.apkg_export_path
        if wrote_via is None and apkg_path is None:
            apkg_path = str(Path.cwd() / f"{_safe_filename(deck_name)}.apkg")
        if apkg_path is not None:
            template = template_for_name(self.config.anki.note_template)
            exporter = ApkgExporter(deck_name, template=template)
            out = exporter.export(cards, apkg_path)
            summary.apkg_path = str(out)
            if wrote_via is None:
                wrote_via = "apkg"
        summary.anki_note_ids = note_ids
        elapsed = time.perf_counter() - t0
        summary.stages.append(
            StageStat(name="write_anki", inputs=len(cards), outputs=len(cards),
                      elapsed_seconds=elapsed, notes=f"backend={wrote_via}")
        )

    @staticmethod
    def _default_deck_name(source: Source) -> str:
        if source.title:
            return source.title
        stem = Path(source.path).stem
        return stem or "mneme deck"


def _safe_filename(name: str) -> str:
    keep = "".join(c if c.isalnum() or c in (" ", "_", "-") else "_" for c in name)
    return keep.strip().replace(" ", "_") or "mneme_deck"
