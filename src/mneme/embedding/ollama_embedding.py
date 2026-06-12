"""Ollama embedding backend.

Calls ``/api/embeddings`` on the local Ollama daemon. Useful when the
user has already pulled an embedding model (e.g.,
``nomic-embed-text``) via Ollama and would rather not install
``sentence-transformers``.
"""
from __future__ import annotations

import logging

import numpy as np
import requests

log = logging.getLogger(__name__)


class OllamaEmbeddingBackend:
    """Wraps Ollama's HTTP embeddings endpoint."""

    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434",
        timeout_s: float = 60.0,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self._session = requests.Session()

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors: list[list[float]] = []
        for text in texts:
            r = self._session.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=self.timeout_s,
            )
            r.raise_for_status()
            data = r.json()
            v = data.get("embedding")
            if not v:
                raise RuntimeError(f"Ollama returned no embedding for text {text[:60]!r}")
            vectors.append(v)
        return np.array(vectors, dtype=np.float32)
