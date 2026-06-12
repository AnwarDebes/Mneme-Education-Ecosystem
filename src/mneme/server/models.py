"""Pydantic models exposed by the API.

Kept in a dedicated module so the OpenAPI schema is the single source
of truth the frontend can generate TypeScript types from (see
``frontend/scripts/gen-types.sh``).
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    LOADING = "loading"
    CHUNKING = "chunking"
    EXTRACTING_FACTS = "extracting_facts"
    GENERATING_CARDS = "generating_cards"
    FILTERING = "filtering"
    DEDUPLICATING = "deduplicating"
    SCORING_DIFFICULTY = "scoring_difficulty"
    WRITING_DECK = "writing_deck"
    DONE = "done"
    ERROR = "error"


class StageEvent(BaseModel):
    """One row in the live progress stream."""

    stage: JobStatus
    message: str
    inputs: int = 0
    outputs: int = 0
    elapsed_seconds: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CardOut(BaseModel):
    """A flashcard returned over the API. Mirrors :class:`mneme.types.Card`."""

    id: str
    question: str
    answer: str
    source_fact: str | None = None
    tags: list[str] = Field(default_factory=list)
    difficulty: str | None = None
    difficulty_rationale: str | None = None
    quality_score: float | None = None


class JobConfig(BaseModel):
    """Run-time overrides chosen by the user in the frontend."""

    model: str = Field(
        "gemma3:12b-it-q4_K_M",
        description="Ollama model tag",
    )
    base_url: str = Field("http://localhost:11434")
    deck_name: str | None = None
    max_facts_per_chunk: int = Field(8, ge=1, le=20)
    max_cards_per_fact: int = Field(2, ge=1, le=5)
    dedup_threshold: float = Field(0.85, ge=0.0, le=1.0)
    difficulty_backend: str = Field("heuristic")
    seed: int | None = 42


class JobSummary(BaseModel):
    id: str
    filename: str
    status: JobStatus
    created_at: datetime
    finished_at: datetime | None = None
    config: JobConfig
    n_chunks: int = 0
    n_facts: int = 0
    n_cards: int = 0
    error: str | None = None


class JobDetail(JobSummary):
    cards: list[CardOut] = Field(default_factory=list)
    events: list[StageEvent] = Field(default_factory=list)
    apkg_path: str | None = None


class GradeRequest(BaseModel):
    """User's grade for a card in the in-browser study mode."""

    grade: str = Field(
        ...,
        description="one of: again, hard, good, easy (FSRS-style)",
    )


class HealthResponse(BaseModel):
    ok: bool
    version: str
    ollama_reachable: bool
    ollama_models: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: str = Field(..., description='"user" or "assistant" or "system"')
    content: str


class ChatRequest(BaseModel):
    """Conversation with the local Ollama model, grounded in a deck's source.

    The backend builds a system prompt from the deck's atomic facts and
    forwards the conversation to Ollama. No state is kept on the server;
    the client is responsible for the history.
    """

    messages: list[ChatMessage] = Field(default_factory=list)
    model: str | None = Field(
        None,
        description="Ollama model tag; defaults to the deck's generation model",
    )
    temperature: float = Field(0.4, ge=0.0, le=2.0)
    system_append: str | None = Field(
        None,
        description="Optional extra instructions appended to the system prompt",
    )


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    model: str
    elapsed_seconds: float


class ImproveCardRequest(BaseModel):
    """Ask the LLM to rewrite or improve a card."""

    question: str
    answer: str
    mode: str = Field(
        "clarify",
        description='"clarify" | "simplify" | "variation" | "harder"',
    )
    model: str | None = None


class ImproveCardResponse(BaseModel):
    question: str
    answer: str
    model: str
    elapsed_seconds: float


class SummarizeRequest(BaseModel):
    model: str | None = None
    style: str = Field(
        "bullets",
        description='"bullets" (3-5 bullet TLDR) or "paragraph" (1-2 sentences)',
    )


class SummarizeResponse(BaseModel):
    summary: str
    model: str
    elapsed_seconds: float


class ExplainRequest(BaseModel):
    question: str
    answer: str
    user_attempt: str | None = None
    source_fact: str | None = None
    model: str | None = None


class ExplainResponse(BaseModel):
    explanation: str
    model: str
    elapsed_seconds: float


class SuggestCardsRequest(BaseModel):
    count: int = Field(5, ge=1, le=20)
    model: str | None = None


class SuggestedCard(BaseModel):
    question: str
    answer: str
    rationale: str | None = None


class SuggestCardsResponse(BaseModel):
    suggestions: list[SuggestedCard]
    model: str
    elapsed_seconds: float


class TextToCardsRequest(BaseModel):
    text: str = Field(..., min_length=10)
    max_cards: int = Field(8, ge=1, le=30)
    model: str | None = None
    base_url: str = Field("http://localhost:11434")


class TextToCardsResponse(BaseModel):
    cards: list[SuggestedCard]
    model: str
    elapsed_seconds: float


class SuggestTagsRequest(BaseModel):
    question: str
    answer: str
    existing_tags: list[str] = Field(default_factory=list)
    model: str | None = None


class SuggestTagsResponse(BaseModel):
    tags: list[str]
    model: str
    elapsed_seconds: float


class ImportCard(BaseModel):
    """Payload for the JSON / CSV / shared-URL deck importer."""

    question: str
    answer: str
    tags: list[str] = Field(default_factory=list)
    difficulty: str | None = None
    source_fact: str | None = None


class ImportRequest(BaseModel):
    filename: str
    cards: list[ImportCard]
    deck_name: str | None = None


class FromUrlRequest(BaseModel):
    """Fetch a remote URL and feed its body through the generator pipeline."""

    url: str
    config: JobConfig | None = None
    deck_name: str | None = None


class SourceViewerResponse(BaseModel):
    """Truncated raw source returned by ``GET /api/jobs/{id}/source`` for the
    in-browser source viewer."""

    filename: str
    kind: str
    bytes: int
    truncated: bool
    content: str


class VisionRequest(BaseModel):
    """Send an image (base64) + question to an Ollama vision model."""

    image_base64: str
    prompt: str = "Describe this image and list any text you can read."
    model: str | None = None
    base_url: str = Field("http://localhost:11434")


class VisionResponse(BaseModel):
    content: str
    model: str
    elapsed_seconds: float


class TranslatedCard(BaseModel):
    """A single translated card returned by ``POST /api/jobs/{id}/translate``."""

    original_id: str
    question: str
    answer: str


class TranslateDeckRequest(BaseModel):
    """Translate every card in a deck into the target language."""

    target_language: str
    model: str | None = None


class TranslateDeckResponse(BaseModel):
    cards: list[TranslatedCard]
    target_language: str
    model: str
    elapsed_seconds: float
