"""Source extractors and the chunker.

Top-level entry point is :func:`load_source`, which dispatches on the
:class:`mneme.types.SourceKind` and returns plain text. The
:class:`Chunker` then splits the text into semantic chunks the LLM
processes one at a time.
"""
from .chunker import Chunker
from .loader import detect_kind, load_source

__all__ = ["Chunker", "load_source", "detect_kind"]
