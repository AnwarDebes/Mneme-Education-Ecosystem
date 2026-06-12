"""Core data types for mneme.

All public objects passing through the pipeline are Pydantic models so
that (a) every boundary is validated, (b) every step's input/output is
JSON-serialisable by construction, and (c) a single source file
defines the schema the rest of the library can be type-checked
against.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# --------------------------------------------------------------------------
# Source documents
# --------------------------------------------------------------------------


class SourceKind(str, Enum):
    """Supported input formats. The pipeline picks the right extractor
    based on this enum, not on file extension alone."""

    PDF = "pdf"
    EPUB = "epub"
    MARKDOWN = "markdown"
    HTML = "html"
    TEXT = "text"
    URL = "url"


class Source(BaseModel):
    """A document handed to the pipeline.

    The pipeline never reads from ``path`` directly; the extractor
    reads it, produces ``text``, and downstream stages work off the
    text + the source's metadata.
    """

    model_config = ConfigDict(frozen=True)

    kind: SourceKind
    path: str = Field(..., description="filesystem path or URL")
    title: str | None = Field(None, description="optional title; defaults to filename stem")
    language: str = Field("en", description="ISO 639-1 language code")


# --------------------------------------------------------------------------
# Pipeline-internal types
# --------------------------------------------------------------------------


class Chunk(BaseModel):
    """A text chunk produced by the chunker.

    Chunks are the unit at which the LLM extracts atomic facts. The
    chunker tries to keep semantic units (a section, a paragraph)
    together rather than splitting blindly on token count.
    """

    model_config = ConfigDict(frozen=True)

    index: int
    text: str
    char_start: int = 0
    char_end: int = 0
    section: str | None = None
    token_count: int | None = None


class AtomicFact(BaseModel):
    """A single self-contained factual statement extracted from a chunk.

    "Self-contained" means the statement should be understandable
    without context. ``Tokyo is the capital of Japan.`` is atomic;
    ``It is the capital`` is not.
    """

    fact: str = Field(..., min_length=3, max_length=500)
    source_chunk: int
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    # The pipeline carries a short rationale through to logs only;
    # it is not used by downstream stages.
    rationale: str | None = None


class CardDifficulty(str, Enum):
    """Discrete card-difficulty class produced by the difficulty scorer."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Card(BaseModel):
    """A flashcard: front / back / metadata.

    The pipeline emits a list of these. Downstream the Anki writer
    converts to AnkiConnect notes or to an .apkg file.
    """

    question: str = Field(..., min_length=3, max_length=400)
    answer: str = Field(..., min_length=1, max_length=600)
    source_fact: str | None = Field(None, description="the atomic fact this card was derived from")
    source_chunk: int | None = None
    tags: list[str] = Field(default_factory=list)
    difficulty: CardDifficulty | None = None
    difficulty_rationale: str | None = Field(
        None, description="human-readable reason for the difficulty rating (TM clauses or heuristic)",
    )
    quality_score: float | None = Field(None, ge=0.0, le=1.0)


# --------------------------------------------------------------------------
# Run summary / provenance
# --------------------------------------------------------------------------


class StageStat(BaseModel):
    """Counts and timing for one pipeline stage. Logged at run end."""

    name: str
    inputs: int = 0
    outputs: int = 0
    elapsed_seconds: float = 0.0
    notes: str | None = None


class RunSummary(BaseModel):
    """End-of-run report. Persisted as JSON beside the .apkg file."""

    model_config = ConfigDict(frozen=False)

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    mneme_version: str
    source: Source
    config_snapshot: dict
    stages: list[StageStat] = Field(default_factory=list)
    cards_emitted: int = 0
    deck_name: str | None = None
    apkg_path: str | None = None
    anki_note_ids: list[int] = Field(default_factory=list)


# Convenience type alias used in function signatures.
PositiveInt = Annotated[int, Field(gt=0)]
