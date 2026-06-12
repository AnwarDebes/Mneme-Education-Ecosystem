# mneme architecture contract

This document fixes the public interfaces and the invariants the
test suite gates on. Treat it as the source of truth for any
implementation change; tests are the proof.

## Public surface

```python
from mneme import (
    Source, SourceKind,        # input description
    Chunk, AtomicFact, Card,   # intermediate data types
    Config,                    # all configuration
    Pipeline,                  # orchestrator
)
```

That is the entire surface a typical user needs. Sub-packages
(`mneme.extraction`, `mneme.cards`, `mneme.difficulty`,
`mneme.anki`) expose backends for advanced users who want to swap
components, but are not required for the common path.

## Stage flow

```
Source -> load_source ----> raw text
raw text -> Chunker -----> list[Chunk]
list[Chunk] -> FactExtractor (LLM) -> list[AtomicFact]
list[AtomicFact] -> CardGenerator (LLM) -> list[Card]
list[Card] -> QualityFilter -> list[Card]
list[Card] -> Deduplicator (embeddings) -> list[Card]
list[Card] -> DifficultyClassifier -> list[Card]
list[Card] -> AnkiConnectClient and / or ApkgExporter
```

Every stage's input and output are Pydantic-validated. A broken
intermediate step throws at the boundary; the rest of the pipeline
does not run on garbage.

## Backend protocols

Every external integration is behind a Protocol so the pipeline
class is unchanged whether we are in production or running a unit
test with a mock.

| Protocol | Production implementation | Test stand-in |
|---|---|---|
| `LLMBackend.complete` | `OllamaBackend` | `MockBackend` (queue or routed) |
| Embedding backend | `SentenceTransformersBackend` or `OllamaEmbeddingBackend` | `TFIDFFallback` |
| `DifficultyClassifier` | `HeuristicDifficulty` or `TsetlinDifficulty` | (heuristic is small enough to use as is) |
| Anki output | `AnkiConnectClient` (online) or `ApkgExporter` (offline) | not mocked; .apkg is tested against the SQLite that ends up on disk |

## Invariants tested by the suite

1. Every public type round-trips through Pydantic validation
   (`tests/test_types.py`).
2. The chunker preserves chunk-index ordering and surfaces token
   counts (`tests/test_chunker.py`).
3. The JSON parser tolerates fenced code blocks, embedded arrays,
   smart quotes, trailing commas, and missing close brackets
   (`tests/test_llm_parsing.py`).
4. The card quality filter drops yes-or-no cards, definitional
   loops, and low-information answers (`tests/test_quality.py`).
5. The deduplicator collapses paraphrases when the threshold is
   permissive and keeps them when it is strict
   (`tests/test_deduplicate.py`).
6. The heuristic difficulty classifier returns easy / medium / hard
   with a non-empty rationale (`tests/test_difficulty.py`).
7. The .apkg exporter writes a valid zip whose embedded SQLite
   contains one row in `col`, plus one note and one card per input
   card (`tests/test_apkg.py`).
8. The full pipeline runs end to end with a `MockBackend` and a
   tiny markdown source, emits at least one card, and writes a
   valid run summary JSON (`tests/test_pipeline.py`).

## Configuration model

```
Config
├── llm: LLMConfig                (Ollama settings: base_url, model, seed, ...)
├── embedding: EmbeddingConfig    (backend, model, dedup_threshold, ...)
├── chunker: ChunkerConfig        (target_tokens, overlap, respect_headings, ...)
├── generator: GeneratorConfig    (max_facts_per_chunk, max_cards_per_fact, ...)
├── quality: QualityConfig        (length bounds, yes-no, definitional loops, ...)
├── difficulty: DifficultyConfig  (backend: heuristic / tsetlin / none, ...)
├── anki: AnkiConfig              (use_ankiconnect, deck_name, apkg_export_path, ...)
├── cache_dir: str                (~/.cache/mneme)
├── log_level: str
└── deterministic: bool
```

Three loaders:

- `Config()` -> defaults.
- `Config.from_yaml(path)` -> loaded from YAML; missing keys keep
  their defaults.
- `Config.from_env(prefix='MNEME_')` -> loaded from environment
  variables. ``MNEME_LLM_MODEL=qwen2.5:14b`` overrides
  ``config.llm.model``.

## Prompts and provenance

All prompt templates live in `mneme.llm.prompts` (Python strings, not
.txt files). Each prompt template returns `(system, user)`. The
module exports `PROMPT_VERSION`; bump it whenever a template changes
semantically. `prompt_provenance()` is recorded in `RunSummary` so
old runs can be reproduced.

## Run summary

After every run the pipeline writes a `RunSummary` JSON next to the
.apkg file. The summary includes:

- mneme version, prompt version,
- source description,
- a snapshot of the config used,
- per-stage input / output counts and elapsed time,
- the deck name written into Anki,
- the AnkiConnect note ids (if AnkiConnect was used),
- the .apkg file path (if exported).

The summary is the audit trail that lets a user (or you, six months
later) reproduce a deck and explain how each card got there.

## Module map

```
src/mneme/
  __init__.py             public surface
  types.py                Pydantic models
  config.py               Config + sub-configs
  pipeline.py             orchestrator
  cli.py                  `mneme` entry point
  extraction/             PDF / EPUB / MD / HTML / TXT / URL loaders + Chunker
  llm/                    LLMBackend protocol, OllamaBackend, MockBackend, prompts, JSON parsing
  cards/                  FactExtractor, CardGenerator, QualityFilter, Deduplicator
  embedding/              sentence-transformers / Ollama / TF-IDF fallback backends
  difficulty/             HeuristicDifficulty, TsetlinDifficulty, feature extraction
  anki/                   AnkiConnectClient, ApkgExporter
  utils/                  seeding, logging, JSONL IO
tests/
examples/
docs/
```

## Out of scope for v0.1

- Cloze cards. Only Basic (front / back) note type.
- Image, audio, math (LaTeX) attachments.
- Sync of card-difficulty learning back into the model from user
  feedback in Anki (the FSRS feedback loop). Planned for v0.2.
- Multilingual chunker (the regex heuristics assume Western
  punctuation). Planned for v0.2.
- Cross-document de-duplication. The deduplicator works within one
  run; runs against the same Anki deck rely on AnkiConnect's
  duplicate scope.
