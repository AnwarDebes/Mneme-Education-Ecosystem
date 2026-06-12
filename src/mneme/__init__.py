"""mneme: a local-first AI flashcard generator.

Public surface
--------------
The supported top-level imports are::

    from mneme import (
        Card,
        AtomicFact,
        Chunk,
        Source,
        Pipeline,
        Config,
        __version__,
    )

Anything below ``mneme.`` not listed in ``__all__`` is internal and
may change without notice between minor versions. Backends (LLM,
embedding, Anki, difficulty) live in their own subpackages and are
swappable via the public :class:`Pipeline` constructor.
"""
from __future__ import annotations

__version__ = "0.1.0"

from .config import Config
from .pipeline import Pipeline
from .types import AtomicFact, Card, Chunk, Source

__all__ = [
    "AtomicFact",
    "Card",
    "Chunk",
    "Config",
    "Pipeline",
    "Source",
    "__version__",
]
