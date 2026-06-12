# Extending mneme

mneme is built around four protocols. Anything that satisfies one of
them can be wired into the pipeline. This page explains the four
extension points and walks through implementing a custom backend.

## The four extension points

| Protocol | Module | What it does |
|---|---|---|
| `LLMBackend` | `mneme.llm.backend` | One call: `complete(prompt, system=..., json_mode=...) -> LLMResponse`. Production wraps Ollama; tests use `MockBackend`. |
| `EmbeddingBackend` | `mneme.cards.deduplicate` | `embed(list[str]) -> np.ndarray`. Three backends ship (sentence-transformers, Ollama, TF-IDF fallback). |
| `DifficultyClassifier` | `mneme.difficulty.protocol` | `score(Card) -> Card` (mutates `difficulty` + `difficulty_rationale`). Two backends ship (heuristic, Tsetlin Machine). |
| Anki output | `mneme.anki.ankiconnect` + `mneme.anki.apkg` | Not a single protocol yet; both `AnkiConnectClient` and `ApkgExporter` expose `add_cards` / `export`. |

The `Pipeline` constructor accepts any of these via dependency
injection:

```python
from mneme import Config, Pipeline
from mneme.embedding import TFIDFFallback

config = Config()
pipeline = Pipeline(
    config,
    llm=MyLLMBackend(),
    embedding_backend=TFIDFFallback(),
    difficulty_classifier=MyClassifier(),
)
```

If you pass `None` (or omit the argument), the pipeline asks the
matching `selector.py` to build the default from `config`.

## Implementing an LLMBackend

Minimal version:

```python
from mneme.llm.backend import LLMBackend, LLMResponse


class EchoBackend:
    """Returns the prompt back as the response. Useful for debugging."""

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        return LLMResponse(text=prompt, model="echo")
```

A real backend talks to whichever LLM runtime you prefer. The full
contract is:

- **Synchronous.** The pipeline calls `complete()` per chunk and per
  fact in a tight loop. If your backend is naturally async, wrap it.
- **Best-effort JSON.** When `json_mode=True`, callers prefer JSON.
  The package's tolerant parser
  (`mneme.llm.parsing.parse_json_payload`) handles fenced blocks,
  trailing prose, and minor repair, so do not raise on small
  malformedness.
- **Retries are your problem.** The pipeline does not retry on
  `LLMError`. The bundled `OllamaBackend` retries with exponential
  backoff internally; do the same in yours.

See [`examples/custom_llm_backend.py`](../examples/custom_llm_backend.py)
for a self-contained example that wraps `llama.cpp` over HTTP.

## Implementing an EmbeddingBackend

```python
from typing import Protocol

import numpy as np


class EmbeddingBackend(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray:
        """Return an (N, D) float32 array."""
        ...
```

The deduplicator L2-normalises the returned vectors before cosine
similarity, so the embedding scale does not matter. The dimension
`D` does need to be consistent across calls.

The bundled `TFIDFFallback` is the reference implementation if you
want a backend with no native deps.

See [`examples/custom_embedding_backend.py`](../examples/custom_embedding_backend.py)
for a worked example.

## Implementing a DifficultyClassifier

```python
from mneme.difficulty.protocol import DifficultyClassifier
from mneme.types import Card, CardDifficulty


class AnswerLengthDifficulty:
    """Toy classifier: longer answers are harder."""

    def score(self, card: Card) -> Card:
        words = len(card.answer.split())
        if words > 10:
            label = CardDifficulty.HARD
        elif words > 3:
            label = CardDifficulty.MEDIUM
        else:
            label = CardDifficulty.EASY
        return card.model_copy(
            update={
                "difficulty": label,
                "difficulty_rationale": f"answer is {words} words",
            }
        )

    def score_many(self, cards: list[Card]) -> list[Card]:
        return [self.score(c) for c in cards]
```

The rationale string is surfaced to users and to the frontend.
Anything that helps a human decide whether to trust the rating is
worth including (the bundled heuristic backend lists every rule
that fired; the Tsetlin backend lists the literals the clauses
voted on).

## Custom prompts

Prompts are Python strings in `src/mneme/llm/prompts.py`. They are
not loaded from disk so prompt changes go through a normal code
review and travel with the test suite.

To experiment with a new prompt:

1. Edit the relevant template (`_ATOMIC_FACTS_SYSTEM`, the body of
   `atomic_facts_prompt`, etc.).
2. Bump `PROMPT_VERSION` to a new string. The version is logged in
   every `RunSummary` so two runs with different prompts can be
   distinguished after the fact.
3. Add or update a test in `tests/test_llm_parsing.py` if the
   prompt's output shape changes.

The frontend reads the prompt version from the summary; mismatches
warn the user that the deck was generated with an older template.

## Adding a new source loader

A loader is a function `load_source(Source) -> str` selected by
`mneme.extraction.loader.load_source` based on `source.kind`. To
support a new format:

1. Add the enum value to `SourceKind` in `src/mneme/types.py`.
2. Write the loader in `src/mneme/extraction/<format>_loader.py`.
3. Register it in `src/mneme/extraction/loader.py`'s dispatch.
4. Update `detect_kind()` to recognise the file extension.
5. Add a test in `tests/test_extraction.py`.

Source loaders return cleaned plain text. The chunker handles
sectioning afterwards, so loaders should preserve headings as
Markdown-style `#` lines or keep them on their own line when the
input format does not have a heading concept.
