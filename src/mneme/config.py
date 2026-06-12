"""Configuration model for mneme.

The :class:`Config` class is the single source of truth for every
tunable knob the pipeline accepts. It can be:

* constructed in Python with sensible defaults,
* loaded from a YAML file via :meth:`Config.from_yaml`,
* loaded from environment variables via :meth:`Config.from_env`.

All defaults are chosen so a user with a fresh Ollama install and the
``qwen2.5:7b-instruct`` model can run the pipeline with zero further
configuration.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LLMConfig(BaseModel):
    """LLM backend settings."""

    model_config = ConfigDict(frozen=False)

    backend: str = Field("ollama", description="one of: ollama, mock")
    base_url: str = Field("http://localhost:11434", description="Ollama HTTP endpoint")
    model: str = Field("qwen2.5:7b-instruct", description="model name on the Ollama server")
    temperature: float = Field(0.2, ge=0.0, le=2.0)
    top_p: float = Field(0.9, ge=0.0, le=1.0)
    num_ctx: int = Field(8192, ge=512, description="context window in tokens")
    seed: int | None = Field(42, description="None to disable deterministic seeding")
    request_timeout_s: float = Field(120.0, gt=0.0)
    max_retries: int = Field(3, ge=0)
    cache_enabled: bool = Field(
        True,
        description=(
            "When True (default) the OllamaBackend is wrapped with a disk "
            "cache under config.cache_dir/llm_cache. Re-running on an "
            "unchanged source skips the LLM entirely. Disable for "
            "throwaway experiments or to force regeneration."
        ),
    )


class EmbeddingConfig(BaseModel):
    """Embedding backend settings (used for semantic de-duplication)."""

    model_config = ConfigDict(frozen=False)

    backend: str = Field(
        "sentence-transformers",
        description="one of: sentence-transformers, ollama, tfidf-fallback, none",
    )
    model: str = Field("BAAI/bge-small-en-v1.5", description="model name or repo id")
    cache_dir: str | None = Field(None, description="defaults to ~/.cache/mneme/models")
    dedup_threshold: float = Field(
        0.85,
        ge=0.0,
        le=1.0,
        description=(
            "cosine similarity above which two cards are considered duplicates. "
            "Lower = more aggressive collapsing (catches paraphrases that share "
            "few words); higher = only near-identical cards are merged. "
            "0.85 was picked from a sweep on the bundled photosynthesis sample: "
            "0.92 left obvious paraphrases (the 6:1 stoichiometry asked four "
            "different ways), 0.80 collapsed semantically distinct cards."
        ),
    )
    max_cards_to_compare: int = Field(2000, ge=10)


class ChunkerConfig(BaseModel):
    """Chunker settings."""

    model_config = ConfigDict(frozen=False)

    target_tokens: int = Field(600, ge=10, description="rough size per chunk")
    overlap_tokens: int = Field(60, ge=0)
    respect_headings: bool = True
    min_chunk_chars: int = Field(80, ge=0, description="drop chunks shorter than this in characters")


class GeneratorConfig(BaseModel):
    """Atomic-fact + card generation settings."""

    model_config = ConfigDict(frozen=False)

    max_facts_per_chunk: int = Field(8, ge=1)
    max_cards_per_fact: int = Field(2, ge=1)
    avoid_yes_no: bool = True
    avoid_trivial: bool = True
    require_complete_sentences: bool = True
    card_type: str = Field(
        "basic",
        description=(
            "Either 'basic' (Q -> A cards) or 'cloze' (sentence with "
            "{{c1::...}} deletions). 'cloze' is opt-in; the default "
            "stays 'basic' for backward compatibility."
        ),
    )


class QualityConfig(BaseModel):
    """Quality filter settings."""

    model_config = ConfigDict(frozen=False)

    min_question_chars: int = 8
    min_answer_chars: int = 1
    max_question_chars: int = 400
    max_answer_chars: int = 600
    drop_yes_no: bool = True
    drop_definitional_loops: bool = True
    drop_low_information: bool = True
    min_quality_score: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="cards below this score (heuristic 0..1) are dropped",
    )


class DifficultyConfig(BaseModel):
    """Difficulty scorer settings."""

    model_config = ConfigDict(frozen=False)

    backend: str = Field(
        "heuristic",
        description="one of: heuristic, tsetlin, none",
    )
    # Tsetlin Machine knobs (only used when backend == 'tsetlin')
    n_clauses: int = Field(50, ge=2)
    T: int = Field(15, ge=1)
    s: float = Field(3.9, gt=1.0)
    state_bits: int = Field(8, ge=2)
    model_path: str | None = Field(None, description="path to a pickled trained classifier")


class AnkiConfig(BaseModel):
    """Anki output settings."""

    model_config = ConfigDict(frozen=False)

    deck_name: str | None = Field(None, description="deck name; default = source filename stem")
    use_ankiconnect: bool = Field(True, description="push to running Anki via AnkiConnect")
    ankiconnect_url: str = Field("http://localhost:8765")
    apkg_export_path: str | None = Field(
        None,
        description="if set, also export a portable .apkg file even when AnkiConnect succeeds",
    )
    note_type: str = Field(
        "Basic",
        description=(
            "Anki note model name AnkiConnect targets when pushing cards. "
            "'Basic' uses Anki's built-in two-field model; any other "
            "value must already exist in the running Anki collection."
        ),
    )
    note_template: str = Field(
        "rich",
        description=(
            "Template used by the .apkg exporter: 'basic' (Front/Back), "
            "'rich' (Front/Back/Source/Difficulty with CSS, the default), "
            "or 'cloze' (cloze-deletion cards)."
        ),
    )
    tag_prefix: str = Field("mneme")


class Config(BaseModel):
    """Top-level configuration object."""

    model_config = ConfigDict(frozen=False)

    llm: LLMConfig = Field(default_factory=LLMConfig)
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    chunker: ChunkerConfig = Field(default_factory=ChunkerConfig)
    generator: GeneratorConfig = Field(default_factory=GeneratorConfig)
    quality: QualityConfig = Field(default_factory=QualityConfig)
    difficulty: DifficultyConfig = Field(default_factory=DifficultyConfig)
    anki: AnkiConfig = Field(default_factory=AnkiConfig)

    cache_dir: str = Field(
        default_factory=lambda: os.path.expanduser("~/.cache/mneme"),
        description="root directory for cached chunks, facts, embeddings, etc.",
    )
    log_level: str = Field("INFO", description="DEBUG / INFO / WARNING / ERROR")
    deterministic: bool = Field(True, description="seed numpy / random / Python hash for reproducibility")

    @field_validator("log_level")
    @classmethod
    def _upper_log_level(cls, v: str) -> str:
        u = v.upper()
        if u not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError(f"invalid log level {v!r}")
        return u

    # ------------------------------------------------------------------
    # Loaders
    # ------------------------------------------------------------------
    @classmethod
    def from_yaml(cls, path: str | Path) -> Config:
        """Load a configuration from a YAML file. Missing keys fall back to defaults."""
        data = yaml.safe_load(Path(path).read_text()) or {}
        if not isinstance(data, dict):
            raise ValueError(f"top-level YAML in {path} must be a mapping")
        return cls.model_validate(data)

    @classmethod
    def from_env(cls, prefix: str = "MNEME_") -> Config:
        """Load a configuration from environment variables.

        Variables follow the dotted-path convention with the prefix
        applied; for example ``MNEME_LLM_MODEL=qwen2.5:14b`` sets
        ``config.llm.model``. Sub-fields are flattened with underscores.
        """
        overrides: dict[str, Any] = {}
        for key, value in os.environ.items():
            if not key.startswith(prefix):
                continue
            path = key[len(prefix):].lower().split("__") if "__" in key else key[len(prefix):].lower().split("_", 1)
            cursor = overrides
            for segment in path[:-1]:
                cursor = cursor.setdefault(segment, {})
            cursor[path[-1]] = _coerce(value)
        return cls.model_validate(overrides)

    def to_yaml(self) -> str:
        """Return the current configuration as a YAML string."""
        return yaml.safe_dump(self.model_dump(mode="json"), sort_keys=False)


def _coerce(s: str) -> Any:
    """Coerce env-string values into bool / int / float where unambiguous."""
    if s.lower() in {"true", "yes"}:
        return True
    if s.lower() in {"false", "no"}:
        return False
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return s
