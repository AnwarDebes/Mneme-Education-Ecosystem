# Changelog

All notable changes to mneme are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the version numbering follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-06-12

### Added

- **Disk-backed LLM response cache** (`mneme.llm.cache.CachedLLMBackend`).
  Re-runs on an unchanged source skip the LLM entirely; cache keys
  include the prompt version, model, seed, temperature, and the
  full prompt text so a single byte change correctly misses. Stats
  (hit / miss / last run) are persisted to
  `<cache_dir>/llm_cache/stats.json`. Disable per-run with
  `mneme build ... --no-cache` or globally with
  `config.llm.cache_enabled = false`.
- **`mneme cache` subcommand**: `cache info` prints the cache root,
  entry count, total size, hit rate; `cache clear` deletes every
  entry; `cache prune --older-than N` drops entries older than N days.
- **Progress bars** (tqdm) on the fact-extraction and card-generation
  loops. Auto-disabled when stderr is not a TTY and via the
  `MNEME_NO_PROGRESS=1` environment variable.
- **Pre-flight estimate**: every `mneme build` logs an upper bound
  on the LLM call count and projected wall-clock time after chunking
  finishes. `mneme build --dry-run` stops there and prints the
  estimate as JSON.
- **Three new quality-filter rules**: identical question and answer,
  source-citation phrases in the answer ("the passage states", "as
  mentioned above"), and answers that echo the question with one
  word substituted.
- **Rich Anki note template (`mneme-rich`, new default)**: four
  fields (Front, Back, Source, Difficulty) with modern, light- and
  dark-mode-aware CSS, an italicised source quote on the back, and
  a coloured difficulty badge. The original two-field `mneme-basic`
  template is retained for backward compatibility.
- **Cloze card support (opt-in)**: `mneme build ... --note-type cloze`
  asks the LLM to produce sentences with `{{c1::...}}` deletions and
  writes them through the new `mneme-cloze` Anki note model.
- **AnkiConnect richer payloads**: when the target model accepts
  Source / Difficulty fields, the client now fills them in alongside
  Front / Back.
- `mneme doctor` subcommand: diagnoses Ollama reachability, model
  availability, AnkiConnect status, and optional dependency
  installation, with actionable remediation hints.
- `mneme models` subcommand: lists models available on the configured
  Ollama daemon with sizes.
- `mneme demo` subcommand: runs the full pipeline end-to-end against
  bundled sample text using a deterministic `MockBackend`, so a fresh
  clone can verify the install without Ollama.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, GitHub issue
  and pull-request templates, and a Dependabot configuration.
- `Makefile` with the common dev targets (`install`, `test`, `lint`,
  `typecheck`, `coverage`, `demo`, `clean`).
- `.pre-commit-config.yaml` wired to ruff and the standard hygiene
  hooks (trailing-whitespace, end-of-file-fixer, check-yaml).
- `.editorconfig` for cross-editor whitespace consistency.
- Documentation: `docs/FAQ.md`, `docs/EXTENDING.md`,
  `docs/TROUBLESHOOTING.md`, `docs/BENCHMARK.md`, `docs/ECOSYSTEM.md`,
  plus a worked `mneme.example.yaml`.
- `examples/custom_llm_backend.py` and
  `examples/custom_embedding_backend.py` show the Protocol-based
  extension surface end-to-end.
- CI now runs `ruff check`, `mypy`, and a coverage report on top of the
  existing pytest matrix.

### Fixed

- The optional FastAPI server now has its own `server` extra
  (`pip install -e ".[server]"` pulls fastapi, sse-starlette, and
  uvicorn); previously `sse-starlette` was not declared anywhere and
  the server tests could not run from a clean install. CI installs
  the extra.

### Changed

- `.apkg` output defaults to the new `mneme-rich` template (Front /
  Back / Source / Difficulty with styled CSS). The model id is
  derived from `template_name/fields_joined`, so the new template
  registers as a distinct Anki model and does not collide with the
  legacy `mneme-basic` model on re-import.
- README gains CI / license / Python-version badges and a short "Why
  mneme?" pitch above the status table.
- CLI subcommands now carry `epilog` strings with copy-pasteable
  examples; help output is more useful at first glance.

## [0.1.0] - 2026-05-24

First public release.

### Added

- End-to-end pipeline: source loaders (PDF, EPUB, Markdown, HTML, TXT,
  URL) -> heading-aware chunker -> two-stage LLM extraction (atomic
  facts -> Q/A cards) -> heuristic quality filter -> semantic
  de-duplication -> heuristic or Tsetlin Machine difficulty scoring ->
  AnkiConnect push and/or .apkg export.
- `OllamaBackend` for local LLM inference with retry and seeded
  determinism; `MockBackend` for unit tests.
- Three embedding backends (`sentence-transformers`, Ollama
  `/api/embeddings`, pure-Python TF-IDF fallback) selected by config.
- `HeuristicDifficulty` and `TsetlinDifficulty` classifiers, both
  emitting a human-readable rationale alongside the discrete class.
- `Config` model with YAML loader, environment-variable loader, and
  JSON-schema dump.
- FastAPI server with SSE event stream, used by the Next.js frontend.
- CLI: `mneme build`, `mneme config print|schema`, `mneme version`.
- 80 tests covering every public boundary; no GPU, Ollama, or Anki
  required to run the suite.
- Versioned prompts and a `RunSummary` artifact that records the
  prompt version, config snapshot, and per-stage counts so any run
  can be reproduced.

[Unreleased]: https://github.com/AnwarDebes/Mneme-Education-Ecosystem/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/AnwarDebes/Mneme-Education-Ecosystem/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AnwarDebes/Mneme-Education-Ecosystem/releases/tag/v0.1.0
