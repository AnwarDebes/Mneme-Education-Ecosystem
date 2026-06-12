"""Embedding backend selector.

Reads :class:`EmbeddingConfig` and returns the right backend
instance, with a graceful fallback chain when optional dependencies
are missing.
"""
from __future__ import annotations

import logging

from ..config import EmbeddingConfig

log = logging.getLogger(__name__)


def build_embedding_backend(config: EmbeddingConfig):
    """Return an embedding backend honouring ``config.backend``.

    Fallback chain: sentence-transformers > ollama > tfidf-fallback.
    """
    if config.backend == "none":
        return None

    if config.backend == "sentence-transformers":
        try:
            from .sentence_transformers_backend import SentenceTransformersBackend

            return SentenceTransformersBackend(model_name=config.model, cache_dir=config.cache_dir)
        except RuntimeError as exc:
            log.warning(
                "sentence-transformers backend unavailable (%s); falling back to tfidf-fallback", exc
            )
            from .fallback import TFIDFFallback

            return TFIDFFallback()

    if config.backend == "ollama":
        from .ollama_embedding import OllamaEmbeddingBackend

        return OllamaEmbeddingBackend(model=config.model)

    if config.backend == "tfidf-fallback":
        from .fallback import TFIDFFallback

        return TFIDFFallback()

    raise ValueError(f"unknown embedding backend {config.backend!r}")
