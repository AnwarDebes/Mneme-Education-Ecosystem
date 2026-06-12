"""Wire a custom LLM backend into the mneme pipeline.

The pipeline accepts any object that satisfies the
:class:`mneme.llm.backend.LLMBackend` protocol. This script shows the
two most common cases:

1. A thin HTTP wrapper around an alternative local runtime (here,
   ``llama.cpp`` exposed via its built-in HTTP server).
2. A logging backend that records every call to a JSONL file while
   delegating to a real backend underneath. Useful for benchmarking
   or for capturing a fixture set for tests.

Run::

    python examples/custom_llm_backend.py examples/sample.md

You will need either ``llama.cpp`` running on port 8080 or your own
underlying backend. Swap the bottom of the file accordingly.
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

import requests

from mneme import Config, Pipeline, Source
from mneme.extraction import detect_kind
from mneme.llm.backend import LLMBackend, LLMResponse

# ---------------------------------------------------------------------------
# Backend 1: HTTP wrapper around llama.cpp's /completion endpoint.
# ---------------------------------------------------------------------------


class LlamaCppBackend:
    """LLM backend that talks to ``llama.cpp``'s built-in HTTP server.

    Start the server with::

        ./llama-server -m model.gguf --port 8080
    """

    def __init__(self, base_url: str = "http://localhost:8080", timeout_s: float = 120.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self._session = requests.Session()

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        full = (system + "\n\n" + prompt) if system else prompt
        body = {
            "prompt": full,
            "temperature": temperature if temperature is not None else 0.2,
            "n_predict": max_tokens if max_tokens is not None else 512,
            "cache_prompt": True,
        }
        if json_mode:
            # llama.cpp supports a grammar; for JSON the simplest path is
            # the prebuilt JSON grammar that ships with llama.cpp.
            body["grammar_file"] = "json.gbnf"
        r = self._session.post(
            f"{self.base_url}/completion",
            json=body,
            timeout=self.timeout_s,
        )
        r.raise_for_status()
        data = r.json()
        return LLMResponse(
            text=data.get("content", ""),
            prompt_tokens=data.get("tokens_evaluated"),
            completion_tokens=data.get("tokens_predicted"),
            model="llama.cpp",
        )


# ---------------------------------------------------------------------------
# Backend 2: a decorator that logs every call.
# ---------------------------------------------------------------------------


class JsonlLoggingBackend:
    """Wrap any LLMBackend and append every (prompt, response) to a JSONL file.

    Useful for capturing a fixture set for tests, for cost accounting,
    or for diffing two prompt versions on the same source.
    """

    def __init__(self, inner: LLMBackend, log_path: str | Path) -> None:
        self.inner = inner
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        response = self.inner.complete(
            prompt,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )
        record = {
            "system": system,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "json_mode": json_mode,
            "response": asdict(response),
        }
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False))
            f.write("\n")
        return response


# ---------------------------------------------------------------------------
# Wire them up.
# ---------------------------------------------------------------------------


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 1

    source_path = sys.argv[1]
    source = Source(kind=detect_kind(source_path), path=source_path)

    config = Config()
    config.anki.use_ankiconnect = False
    config.anki.apkg_export_path = "out.apkg"
    config.embedding.backend = "tfidf-fallback"

    # Pick a real backend. Replace this line to talk to whatever you have.
    inner = LlamaCppBackend(base_url="http://localhost:8080")

    # Wrap it so every call goes into a JSONL log.
    backend = JsonlLoggingBackend(inner, log_path="llm-trace.jsonl")

    summary = Pipeline(config, llm=backend).run(source)
    print(json.dumps({"cards_emitted": summary.cards_emitted}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
