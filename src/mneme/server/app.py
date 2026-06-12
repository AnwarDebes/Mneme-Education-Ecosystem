"""FastAPI app.

Endpoints
---------
GET  /api/health
GET  /api/ollama/models
POST /api/jobs                   upload + start
GET  /api/jobs                   list
GET  /api/jobs/{job_id}          detail
GET  /api/jobs/{job_id}/events   SSE stream of StageEvent
GET  /api/jobs/{job_id}/cards    cards only
GET  /api/jobs/{job_id}/apkg     download the .apkg file
POST /api/jobs/{job_id}/study/grade   accept FSRS-style grade for a card

CORS is opened for the frontend dev server on ``http://localhost:3000``
and for ``*.vercel.app`` so a deployed frontend can call a locally-run
backend through a tunnel.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from .. import __version__
from ..types import Card
from .jobs import JobRegistry
from .logging_setup import configure_logging
from .models import (
    CardOut,
    ChatRequest,
    ChatResponse,
    ExplainRequest,
    ExplainResponse,
    FromUrlRequest,
    GradeRequest,
    HealthResponse,
    ImportRequest,
    ImproveCardRequest,
    ImproveCardResponse,
    JobConfig,
    JobDetail,
    JobSummary,
    SourceViewerResponse,
    SuggestCardsRequest,
    SuggestCardsResponse,
    SuggestedCard,
    SuggestTagsRequest,
    SuggestTagsResponse,
    SummarizeRequest,
    SummarizeResponse,
    TextToCardsRequest,
    TextToCardsResponse,
    TranslatedCard,
    TranslateDeckRequest,
    TranslateDeckResponse,
    VisionRequest,
    VisionResponse,
)

configure_logging()
log = logging.getLogger("mneme.server")


# --------------------------------------------------------------------------
# App and global state
# --------------------------------------------------------------------------

_UPLOAD_DIR = Path(os.environ.get("MNEME_UPLOAD_DIR", tempfile.gettempdir())) / "mneme_uploads"
_REGISTRY = JobRegistry(_UPLOAD_DIR)

app = FastAPI(
    title="mneme API",
    version=__version__,
    description="Local-first AI flashcard generator. REST + SSE wrapper over the mneme pipeline.",
)

# CORS: allow the local dev frontend (Next.js default port 3000), any
# Vercel preview deployment, and any explicitly-named host via env var.
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_extra = os.environ.get("MNEME_CORS_ORIGINS", "").split(",")
_ALLOWED_ORIGINS.extend(o.strip() for o in _extra if o.strip())
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _card_to_out(card: Card) -> CardOut:
    return CardOut(
        id=_card_id(card),
        question=card.question,
        answer=card.answer,
        source_fact=card.source_fact,
        tags=list(card.tags),
        difficulty=card.difficulty.value if card.difficulty else None,
        difficulty_rationale=card.difficulty_rationale,
        quality_score=card.quality_score,
    )


def _card_id(card: Card) -> str:
    """Stable hex id derived from question + answer."""
    import hashlib

    return hashlib.sha1(f"{card.question}|{card.answer}".encode()).hexdigest()[:12]


# --------------------------------------------------------------------------
# Health and ollama
# --------------------------------------------------------------------------


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return server info and whether Ollama is reachable."""
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    models: list[str] = []
    ok = False
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=3.0)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        ok = True
    except Exception:
        ok = False
    return HealthResponse(ok=True, version=__version__, ollama_reachable=ok, ollama_models=models)


@app.get("/api/ollama/models")
def list_ollama_models() -> dict[str, Any]:
    """Pass-through to Ollama's /api/tags."""
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=5.0)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable: {exc}")


# --------------------------------------------------------------------------
# Job management
# --------------------------------------------------------------------------


@app.post("/api/jobs", response_model=JobSummary)
async def create_job(
    request: Request,
    file: UploadFile = File(...),
    config: str | None = Form(None),
) -> JobSummary:
    """Upload a file and start a new generation job."""
    job_config = JobConfig.model_validate_json(config) if config else JobConfig()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty upload")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (max 25 MB for v0.1)")
    job = _REGISTRY.create(file.filename or "upload", content, job_config)
    loop = asyncio.get_running_loop()
    _REGISTRY.run_in_background(job, loop)
    return _summary(job)


@app.get("/api/jobs", response_model=list[JobSummary])
def list_jobs() -> list[JobSummary]:
    return [_summary(j) for j in _REGISTRY.list_jobs()]


@app.post("/api/jobs/import", response_model=JobSummary)
def import_cards(body: ImportRequest) -> JobSummary:
    """Create a done-state job from a JSON / CSV / shared-URL payload."""
    if not body.cards:
        raise HTTPException(status_code=400, detail="no cards in import payload")
    config = JobConfig(deck_name=body.deck_name or body.filename)
    outs: list[CardOut] = []
    import hashlib

    for raw in body.cards:
        q = (raw.question or "").strip()
        a = (raw.answer or "").strip()
        if not q or not a:
            continue
        cid = hashlib.sha1(f"{q}|{a}".encode()).hexdigest()[:12]
        outs.append(
            CardOut(
                id=cid,
                question=q,
                answer=a,
                tags=list(raw.tags or []),
                difficulty=raw.difficulty,
                source_fact=raw.source_fact,
            )
        )
    if not outs:
        raise HTTPException(status_code=400, detail="every card was empty")
    job = _REGISTRY.register_imported(body.filename, config, outs)
    return _summary(job)


@app.post("/api/jobs/import-apkg", response_model=JobSummary)
async def import_apkg(file: UploadFile = File(...)) -> JobSummary:
    """Parse an Anki .apkg and register its notes as a new deck.

    .apkg is a ZIP with a ``collection.anki2`` SQLite file inside. Fields
    are joined by U+001F. We take the first two as Q and A; the rest are
    ignored. Tags become tags.
    """
    import io
    import sqlite3
    import tempfile
    import zipfile

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="not a valid .apkg (zip) file")
    db_name = next(
        (n for n in zf.namelist() if n.lower() in {"collection.anki2", "collection.anki21"}),
        None,
    )
    if not db_name:
        raise HTTPException(status_code=400, detail=".apkg has no collection.anki2 inside")

    cards: list[CardOut] = []
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "collection.anki2"
        path.write_bytes(zf.read(db_name))
        conn = sqlite3.connect(str(path))
        try:
            cursor = conn.execute("SELECT flds, tags FROM notes")
            import hashlib

            for flds, tags in cursor.fetchall():
                parts = (flds or "").split("\x1f")
                if len(parts) < 2:
                    continue
                # Strip HTML tags from Anki fields for the in-app view.
                q = _strip_html(parts[0]).strip()
                a = _strip_html(parts[1]).strip()
                if not q or not a:
                    continue
                cid = hashlib.sha1(f"{q}|{a}".encode()).hexdigest()[:12]
                tag_list = [t for t in (tags or "").split(" ") if t]
                cards.append(
                    CardOut(
                        id=cid,
                        question=q,
                        answer=a,
                        tags=tag_list,
                    )
                )
        finally:
            conn.close()
    if not cards:
        raise HTTPException(status_code=400, detail="no valid notes found in .apkg")

    filename = file.filename or "imported.apkg"
    job = _REGISTRY.register_imported(
        filename,
        JobConfig(deck_name=filename.rsplit(".", 1)[0]),
        cards,
    )
    return _summary(job)


_HTML_TAG_RE = None


def _strip_html(text: str) -> str:
    """Very small HTML stripper for Anki note fields."""
    global _HTML_TAG_RE
    import re

    if _HTML_TAG_RE is None:
        _HTML_TAG_RE = re.compile(r"<[^>]+>")
    s = _HTML_TAG_RE.sub("", text)
    return (
        s.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
    )


@app.post("/api/jobs/from-url", response_model=JobSummary)
async def create_job_from_url(body: FromUrlRequest) -> JobSummary:
    """Fetch a URL, save it to the upload dir, and run the pipeline on it."""
    import re

    from .safety import UnsafeURLError, ensure_public_url

    url = body.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="url must start with http:// or https://")
    try:
        ensure_public_url(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"refusing to fetch: {exc}")
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "mneme/1.0"}, allow_redirects=False)
        if r.is_redirect or r.is_permanent_redirect:
            # A redirect could land on a private address; re-validate the next hop
            # rather than following blind.
            next_url = r.headers.get("Location", "")
            if next_url:
                ensure_public_url(next_url)
                r = requests.get(next_url, timeout=20, headers={"User-Agent": "mneme/1.0"}, allow_redirects=False)
        r.raise_for_status()
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"refusing to follow redirect: {exc}")
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"could not fetch URL: {exc}")
    content = r.content
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="page too large (max 25 MB)")
    ctype = (r.headers.get("Content-Type") or "").lower()
    if "html" in ctype or url.endswith(".html"):
        ext = ".html"
    elif "pdf" in ctype or url.endswith(".pdf"):
        ext = ".pdf"
    elif "markdown" in ctype or url.endswith(".md"):
        ext = ".md"
    else:
        ext = ".html"
    # Derive a reasonable filename from the URL path.
    slug = re.sub(r"[^a-z0-9._-]+", "-", url.split("/")[-1].lower()).strip("-") or "page"
    if not slug.endswith(ext):
        slug = f"{slug}{ext}"
    config = body.config or JobConfig()
    if body.deck_name:
        config.deck_name = body.deck_name
    job = _REGISTRY.create(slug, content, config)
    loop = asyncio.get_running_loop()
    _REGISTRY.run_in_background(job, loop)
    return _summary(job)


@app.get("/api/jobs/{job_id}/source", response_model=SourceViewerResponse)
def job_source(job_id: str, max_chars: int = 200000) -> SourceViewerResponse:
    """Return the (truncated) raw source for the in-browser source viewer."""
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if not job.file_path or not Path(job.file_path).exists():
        return SourceViewerResponse(
            filename=job.filename,
            kind="missing",
            bytes=0,
            truncated=False,
            content="(no source file on disk; this deck was imported as cards)",
        )

    path = Path(job.file_path)
    raw = path.read_bytes()
    size = len(raw)
    # Plain text + markdown: just decode.
    if job.filename.lower().endswith((".md", ".txt", ".html", ".htm")):
        try:
            text = raw.decode("utf-8", errors="replace")
        except Exception:
            text = "(could not decode)"
        if job.filename.lower().endswith((".html", ".htm")):
            text = _strip_html(text)
        text = text.strip()
        truncated = len(text) > max_chars
        return SourceViewerResponse(
            filename=job.filename,
            kind="text",
            bytes=size,
            truncated=truncated,
            content=text[:max_chars],
        )
    # PDF and EPUB: reuse mneme's loader if it produced any chunks; otherwise
    # surface the unique source facts as a sensible reconstruction.
    seen: set[str] = set()
    facts: list[str] = []
    for card in job.cards:
        f = (card.source_fact or "").strip()
        if not f or f in seen:
            continue
        seen.add(f)
        facts.append(f)
    text = "\n\n".join(facts) if facts else "(binary source; no extracted text available)"
    truncated = len(text) > max_chars
    return SourceViewerResponse(
        filename=job.filename,
        kind="binary",
        bytes=size,
        truncated=truncated,
        content=text[:max_chars],
    )


@app.get("/api/jobs/{job_id}", response_model=JobDetail)
def job_detail(job_id: str) -> JobDetail:
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.to_detail()


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    """Permanently remove a job: drops it from the in-memory registry and
    best-effort deletes the uploaded source + generated .apkg. The user's
    local browser-side overrides/schedule still need to be cleared by the
    client (see deck-store cleanup on the frontend)."""
    if not _REGISTRY.remove(job_id):
        raise HTTPException(status_code=404, detail="job not found")
    return {"status": "deleted", "job_id": job_id}


@app.get("/api/jobs/{job_id}/cards", response_model=list[CardOut])
def job_cards(job_id: str) -> list[CardOut]:
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return list(job.cards)


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request) -> EventSourceResponse:
    """Server-Sent Events: live pipeline progress."""
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    queue = job.subscribe()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # heartbeat
                    yield {"event": "ping", "data": ""}
                    continue
                if event is None:
                    yield {
                        "event": "end",
                        "data": json.dumps({"status": job.status.value, "n_cards": len(job.cards)}),
                    }
                    return
                yield {"event": "stage", "data": event.model_dump_json()}
        except asyncio.CancelledError:
            return

    return EventSourceResponse(event_generator())


@app.get("/api/jobs/{job_id}/apkg")
def job_apkg(job_id: str) -> FileResponse:
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if not job.apkg_path:
        raise HTTPException(status_code=404, detail="apkg not yet written")
    path = Path(job.apkg_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="apkg file missing on disk")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=f"{job.config.deck_name or job.filename.rsplit('.', 1)[0]}.apkg",
    )


# --------------------------------------------------------------------------
# In-browser study mode
# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# Chat with the deck source
# --------------------------------------------------------------------------


_CHAT_SYSTEM_PROMPT = (
    "You are a focused study tutor for a specific source document. Below is a "
    "list of atomic facts extracted from that source. Use only these facts (and "
    "general knowledge needed to interpret them) to answer the student. If a "
    "question cannot be answered from the source, say so plainly. Keep answers "
    "concise and well-structured. Quote facts verbatim when helpful.\n\n"
    "SOURCE FACTS:\n"
)


def _chat_context(job) -> tuple[str, int]:
    """Build the system prompt context from a job's unique source facts."""
    seen: set[str] = set()
    facts: list[str] = []
    for card in job.cards:
        f = (card.source_fact or "").strip()
        if not f or f in seen:
            continue
        seen.add(f)
        facts.append(f"- {f}")
    if not facts:
        return _CHAT_SYSTEM_PROMPT + "(no facts available)", 0
    return _CHAT_SYSTEM_PROMPT + "\n".join(facts), len(facts)


@app.post("/api/jobs/{job_id}/chat", response_model=ChatResponse)
def chat_with_deck(job_id: str, body: ChatRequest) -> ChatResponse:
    """Chat with Ollama using the deck's atomic facts as grounded context."""
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model
    system, n_facts = _chat_context(job)
    if body.system_append:
        system = system + "\n\nADDITIONAL INSTRUCTIONS:\n" + body.system_append

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            *[{"role": m.role, "content": m.content} for m in body.messages],
        ],
        "stream": False,
        "options": {"temperature": body.temperature},
    }

    started = time.time()
    try:
        r = requests.post(
            f"{base_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}")

    content = (data.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Ollama returned an empty response")
    return ChatResponse(
        content=content,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/jobs/{job_id}/summarize", response_model=SummarizeResponse)
def summarize_deck(job_id: str, body: SummarizeRequest) -> SummarizeResponse:
    """Use Ollama to write a TL;DR for this deck's source material."""
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model
    context, n_facts = _chat_context(job)
    if n_facts == 0:
        raise HTTPException(status_code=400, detail="this deck has no source facts to summarize")

    if body.style == "paragraph":
        system = (
            "You are summarizing a study deck's source material into a tight "
            "paragraph of 1-2 sentences for a student. Use only the source facts "
            "below. Plain prose, no lists, no markdown headings."
        )
    else:
        system = (
            "You are summarizing a study deck's source material into 3-5 bullet "
            "points. Each bullet is one sentence, plain language, captures the "
            "core takeaway. Use only the source facts below. Output as a markdown "
            "list with no preamble."
        )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system + "\n\n" + context},
            {"role": "user", "content": "Summarize the source above."},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    }
    started = time.time()
    try:
        r = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=90)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}")
    content = (data.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Ollama returned an empty summary")
    return SummarizeResponse(
        summary=content,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/jobs/{job_id}/cards/explain", response_model=ExplainResponse)
def explain_card(job_id: str, body: ExplainRequest) -> ExplainResponse:
    """Have Ollama explain why the expected answer is correct, optionally
    addressing the student's wrong attempt."""
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model

    system = (
        "You are a kind, concise tutor. Explain why the expected answer is "
        "correct, in 2-4 short paragraphs. If the student attempted an answer, "
        "address what they got right and where they went wrong. End with one "
        "memorable mnemonic or analogy. Use plain prose, no headings."
    )
    user_lines = [
        f"Question: {body.question}",
        f"Expected answer: {body.answer}",
    ]
    if body.source_fact:
        user_lines.append(f"Source fact: {body.source_fact}")
    if body.user_attempt:
        user_lines.append(f"Student's attempt: {body.user_attempt}")
    user_lines.append("Please explain.")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": "\n".join(user_lines)},
        ],
        "stream": False,
        "options": {"temperature": 0.4},
    }
    started = time.time()
    try:
        r = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=90)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}")
    content = (data.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Ollama returned an empty explanation")
    return ExplainResponse(
        explanation=content,
        model=model,
        elapsed_seconds=time.time() - started,
    )


def _call_ollama_chat_json(base_url: str, model: str, system: str, user: str, timeout: float = 90.0) -> Any:
    """Helper for the AI-authoring endpoints. Asks Ollama for JSON output."""
    import json as _json

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.5},
        "format": "json",
    }
    try:
        r = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=timeout)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}")
    content = (data.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Ollama returned an empty response")
    try:
        return _json.loads(content)
    except _json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"could not parse JSON from model response: {content[:200]}",
        )


@app.post("/api/jobs/{job_id}/cards/suggest", response_model=SuggestCardsResponse)
def suggest_cards(job_id: str, body: SuggestCardsRequest) -> SuggestCardsResponse:
    """Ask the LLM to suggest NEW cards that fill gaps in the existing deck."""
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model
    context, n_facts = _chat_context(job)
    if n_facts == 0:
        raise HTTPException(status_code=400, detail="this deck has no source facts to extend")

    existing_qs = "\n".join(f"- {c.question}" for c in job.cards[:50])
    system = (
        "You are extending a flashcard deck. Below are the source facts and the "
        "questions already covered. Suggest NEW question/answer pairs that cover "
        "gaps - facts that are stated but not yet questioned. Do not duplicate "
        "existing questions. Each card must be grounded in the source.\n\n"
        "Output JSON exactly in this shape: "
        '{"cards": [{"question": "...", "answer": "...", "rationale": "..."}]} '
        "where rationale is a 1-sentence note on what gap this fills."
    )
    user = (
        f"{context}\n\nEXISTING QUESTIONS (do NOT repeat):\n{existing_qs}\n\n"
        f"Generate exactly {body.count} new cards. Respond with JSON only."
    )

    started = time.time()
    parsed = _call_ollama_chat_json(base_url, model, system, user)
    items = parsed.get("cards") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="model did not return a 'cards' array")
    suggestions: list[SuggestedCard] = []
    for item in items[: body.count]:
        if not isinstance(item, dict):
            continue
        q = (item.get("question") or "").strip()
        a = (item.get("answer") or "").strip()
        rationale = (item.get("rationale") or "").strip() or None
        if q and a:
            suggestions.append(SuggestedCard(question=q, answer=a, rationale=rationale))
    if not suggestions:
        raise HTTPException(status_code=502, detail="model returned no usable suggestions")
    return SuggestCardsResponse(
        suggestions=suggestions,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/cards/from-text", response_model=TextToCardsResponse)
def cards_from_text(body: TextToCardsRequest) -> TextToCardsResponse:
    """Convert a raw paragraph of text into flashcards on the fly.

    Independent of any existing deck. Useful for quick "I just read this,
    quiz me on it" workflows.
    """
    import time

    base_url = os.environ.get("OLLAMA_BASE_URL", body.base_url or "http://localhost:11434")
    model = body.model
    if not model:
        # Pick whatever Ollama has pulled.
        try:
            r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=3.0)
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            preferred = next(
                (m for m in models if any(p in m.lower() for p in ("qwen2.5", "llama3", "gemma3"))),
                None,
            )
            model = preferred or (models[0] if models else None)
        except Exception:
            model = None
    if not model:
        raise HTTPException(status_code=503, detail="no Ollama model available")

    system = (
        "You are extracting atomic flashcards from a passage of text. Each card "
        "is a single fact: one clear question, one short answer. Prefer 'what / "
        "where / when / how many' over 'why'. Keep answers under 12 words when "
        "possible.\n\n"
        "Output JSON exactly in this shape: "
        '{"cards": [{"question": "...", "answer": "..."}]}'
    )
    user = f"PASSAGE:\n{body.text}\n\nReturn at most {body.max_cards} cards as JSON."

    started = time.time()
    parsed = _call_ollama_chat_json(base_url, model, system, user)
    items = parsed.get("cards") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="model did not return a 'cards' array")
    cards: list[SuggestedCard] = []
    for item in items[: body.max_cards]:
        if not isinstance(item, dict):
            continue
        q = (item.get("question") or "").strip()
        a = (item.get("answer") or "").strip()
        if q and a:
            cards.append(SuggestedCard(question=q, answer=a))
    if not cards:
        raise HTTPException(status_code=502, detail="model returned no usable cards")
    return TextToCardsResponse(
        cards=cards,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/jobs/{job_id}/cards/suggest-tags", response_model=SuggestTagsResponse)
def suggest_tags(job_id: str, body: SuggestTagsRequest) -> SuggestTagsResponse:
    """Ask the LLM for 1-3 concise tags for a card."""
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model

    existing = ", ".join(body.existing_tags) or "(none)"
    system = (
        "You are tagging a single flashcard. Suggest 1-3 short, lowercase tags "
        "(single words, hyphenate compound terms). Prefer reusing existing tags "
        "from the deck when relevant. No quotes, no #, no spaces inside tags.\n\n"
        'Output JSON exactly in this shape: {"tags": ["t1", "t2"]}'
    )
    user = (
        f"QUESTION: {body.question}\nANSWER: {body.answer}\n"
        f"EXISTING TAGS IN DECK: {existing}\nRespond with JSON only."
    )

    started = time.time()
    parsed = _call_ollama_chat_json(base_url, model, system, user, timeout=45.0)
    raw_tags = parsed.get("tags") if isinstance(parsed, dict) else None
    if not isinstance(raw_tags, list):
        raise HTTPException(status_code=502, detail="model did not return a 'tags' array")
    cleaned: list[str] = []
    for t in raw_tags:
        if not isinstance(t, str):
            continue
        s = t.strip().lower().lstrip("#").replace(" ", "-")
        s = "".join(ch for ch in s if ch.isalnum() or ch in "-_")
        if s and s not in cleaned:
            cleaned.append(s)
        if len(cleaned) >= 5:
            break
    return SuggestTagsResponse(
        tags=cleaned,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/jobs/{job_id}/translate", response_model=TranslateDeckResponse)
def translate_deck(job_id: str, body: TranslateDeckRequest) -> TranslateDeckResponse:
    """Translate every card in a deck into the target language via Ollama.

    Cards stream in batches of 6 to keep prompts tractable.
    """
    import json as _json
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if not job.cards:
        raise HTTPException(status_code=400, detail="this deck has no cards")

    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model
    target = body.target_language.strip()
    if len(target) < 2:
        raise HTTPException(status_code=400, detail="target_language must be at least 2 chars")

    system = (
        f"You are translating flashcards into {target}. Preserve meaning. "
        "Keep technical terms (Latin scientific names, equations, code) "
        "untranslated unless idiomatically required. For each input card "
        "indexed by id, return the translation."
    )
    out_cards: list[TranslatedCard] = []
    started = time.time()
    batch_size = 6
    for i in range(0, len(job.cards), batch_size):
        batch = job.cards[i : i + batch_size]
        user_items = [{"id": c.id, "question": c.question, "answer": c.answer} for c in batch]
        user = (
            "Translate each card. Output JSON in the form: "
            '{"cards": [{"id": "...", "question": "...", "answer": "..."}]}\n\n'
            f"INPUT:\n{_json.dumps(user_items, ensure_ascii=False)}"
        )
        parsed = _call_ollama_chat_json(base_url, model, system, user, timeout=120.0)
        items = parsed.get("cards") if isinstance(parsed, dict) else None
        if not isinstance(items, list):
            continue
        seen = set()
        for it in items:
            if not isinstance(it, dict):
                continue
            cid = (it.get("id") or "").strip()
            q = (it.get("question") or "").strip()
            a = (it.get("answer") or "").strip()
            if not cid or not q or not a:
                continue
            if cid in seen:
                continue
            seen.add(cid)
            out_cards.append(TranslatedCard(original_id=cid, question=q, answer=a))
    if not out_cards:
        raise HTTPException(status_code=502, detail="model returned no translations")
    return TranslateDeckResponse(
        cards=out_cards,
        target_language=target,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.get("/api/vision/check")
def vision_check() -> dict:
    """Quick probe used by the frontend to gate the vision UI.

    Returns whether at least one locally-pulled vision model is available,
    plus the resolved model name. Cheap enough to call from any dialog open.
    """
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=3.0)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        preferred = next(
            (m for m in models if any(p in m.lower() for p in ("llava", "bakllava", "moondream", "minicpm-v"))),
            None,
        )
        return {"available": preferred is not None, "model": preferred, "candidates": models}
    except Exception as exc:
        return {"available": False, "model": None, "error": str(exc)}


@app.post("/api/vision/ask", response_model=VisionResponse)
def vision_ask(body: VisionRequest) -> VisionResponse:
    """Send a base64-encoded image + prompt to an Ollama vision model.

    Defaults to ``llava`` if installed; the user is responsible for pulling
    the model locally. Used by the OCR / image-to-card workflow.
    """
    import time

    from .safety import ensure_payload_size

    try:
        ensure_payload_size(body.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    base_url = os.environ.get("OLLAMA_BASE_URL", body.base_url or "http://localhost:11434")
    model = body.model
    if not model:
        # Look for any locally-pulled vision-capable model.
        try:
            r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=3.0)
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", [])]
            preferred = next(
                (m for m in models if any(p in m.lower() for p in ("llava", "bakllava", "moondream", "minicpm-v"))),
                None,
            )
            model = preferred or (models[0] if models else None)
        except Exception:
            model = None
    if not model:
        raise HTTPException(status_code=503, detail="no Ollama vision model available")

    started = time.time()
    try:
        r = requests.post(
            f"{base_url.rstrip('/')}/api/chat",
            json={
                "model": model,
                "messages": [{"role": "user", "content": body.prompt, "images": [body.image_base64]}],
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama vision error: {exc}")
    content = (data.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="vision model returned empty response")
    return VisionResponse(content=content, model=model, elapsed_seconds=time.time() - started)


_IMPROVE_PROMPTS = {
    "clarify": (
        "You are improving a flashcard. Rewrite the question and answer so the "
        "wording is clearer and more precise. Keep the same meaning. Output JSON "
        "exactly in the form: {\"question\": \"...\", \"answer\": \"...\"} with no "
        "extra text."
    ),
    "simplify": (
        "You are improving a flashcard. Rewrite the question and answer in simpler, "
        "plainer language a beginner could follow, without losing the key fact. "
        "Output JSON exactly in the form: {\"question\": \"...\", \"answer\": \"...\"}."
    ),
    "variation": (
        "You are improving a flashcard. Produce a different but equivalent way of "
        "asking the same fact. Vary the phrasing significantly. Output JSON exactly "
        "in the form: {\"question\": \"...\", \"answer\": \"...\"}."
    ),
    "harder": (
        "You are improving a flashcard. Make the question harder: require deeper "
        "understanding or application, not just recall. Keep the answer accurate. "
        "Output JSON exactly in the form: {\"question\": \"...\", \"answer\": \"...\"}."
    ),
}


@app.post("/api/jobs/{job_id}/cards/improve", response_model=ImproveCardResponse)
def improve_card(job_id: str, body: ImproveCardRequest) -> ImproveCardResponse:
    """Use Ollama to rewrite the given Q/A pair according to ``mode``."""
    import json as _json
    import time

    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    mode = (body.mode or "clarify").lower()
    if mode not in _IMPROVE_PROMPTS:
        raise HTTPException(status_code=400, detail=f"unknown improve mode: {mode}")
    base_url = os.environ.get("OLLAMA_BASE_URL", job.config.base_url or "http://localhost:11434")
    model = body.model or job.config.model

    system = _IMPROVE_PROMPTS[mode]
    user = f"QUESTION: {body.question}\nANSWER: {body.answer}\n\nReturn the improved JSON only."

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
        "format": "json",
    }
    started = time.time()
    try:
        r = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}")
    raw = (data.get("message", {}) or {}).get("content", "").strip()
    parsed_q: str | None = None
    parsed_a: str | None = None
    try:
        parsed = _json.loads(raw)
        parsed_q = (parsed.get("question") or "").strip() or None
        parsed_a = (parsed.get("answer") or "").strip() or None
    except _json.JSONDecodeError:
        # Last-ditch: try to grep "question: x answer: y"
        for line in raw.splitlines():
            low = line.lower()
            if low.startswith("question:") and parsed_q is None:
                parsed_q = line.split(":", 1)[1].strip().strip('"')
            if low.startswith("answer:") and parsed_a is None:
                parsed_a = line.split(":", 1)[1].strip().strip('"')
    if not parsed_q or not parsed_a:
        raise HTTPException(
            status_code=502,
            detail=f"could not parse improved card from model response: {raw[:200]}",
        )
    return ImproveCardResponse(
        question=parsed_q,
        answer=parsed_a,
        model=model,
        elapsed_seconds=time.time() - started,
    )


@app.post("/api/jobs/{job_id}/study/grade")
def grade_card(job_id: str, body: GradeRequest) -> dict[str, str]:
    """Accept a study-mode grade for a card.

    v0.1 just logs the grade; the FSRS feedback loop (re-train the TM
    difficulty classifier on user grades) is a v0.2 item.
    """
    job = _REGISTRY.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    log.info("job %s graded card with %s", job_id, body.grade)
    return {"status": "ok"}


# --------------------------------------------------------------------------
# Internals
# --------------------------------------------------------------------------


def _summary(job) -> JobSummary:
    return JobSummary(
        id=job.id,
        filename=job.filename,
        status=job.status,
        created_at=job.created_at,
        finished_at=job.finished_at,
        config=job.config,
        n_chunks=job.n_chunks,
        n_facts=job.n_facts,
        n_cards=len(job.cards),
        error=job.error,
    )
