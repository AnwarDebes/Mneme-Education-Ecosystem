"""Embedding backends for semantic de-duplication.

Three backends are provided:

- :class:`SentenceTransformersBackend`: BGE / GTE / Nomic via the
  ``sentence-transformers`` library. Default and recommended.
- :class:`OllamaEmbeddingBackend`: talks to a running Ollama daemon's
  ``/api/embeddings`` endpoint. Use when an embedding model is
  already pulled in Ollama.
- :class:`TFIDFFallback`: pure-Python TF-IDF cosine. Used when the
  user does not install any optional embedding deps.

All three implement :class:`EmbeddingBackend` from
:mod:`mneme.cards.deduplicate`.
"""
from .fallback import TFIDFFallback
from .ollama_embedding import OllamaEmbeddingBackend
from .selector import build_embedding_backend
from .sentence_transformers_backend import SentenceTransformersBackend

__all__ = [
    "SentenceTransformersBackend",
    "OllamaEmbeddingBackend",
    "TFIDFFallback",
    "build_embedding_backend",
]
