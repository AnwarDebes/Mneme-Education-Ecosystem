"""Sentence-Transformers embedding backend.

Default backend. Loads BGE-small-en-v1.5 by default; users can pass
any other model id to the constructor.

The constructor accepts a cache directory so models live under
``~/.cache/mneme/models`` by default, not in the user's home root.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)


class SentenceTransformersBackend:
    """Wraps ``sentence_transformers.SentenceTransformer``."""

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", cache_dir: str | None = None) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise RuntimeError(
                "sentence-transformers is required for this backend. "
                "Install with: pip install sentence-transformers"
            ) from exc

        cache_dir = cache_dir or os.path.expanduser("~/.cache/mneme/models")
        Path(cache_dir).mkdir(parents=True, exist_ok=True)
        log.info("loading embedding model %s (cache_dir=%s)", model_name, cache_dir)
        self._model = SentenceTransformer(model_name, cache_folder=cache_dir)
        self.model_name = model_name

    def embed(self, texts: list[str]) -> np.ndarray:
        return self._model.encode(texts, show_progress_bar=False, normalize_embeddings=False)
