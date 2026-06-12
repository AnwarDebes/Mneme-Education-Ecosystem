"""Source loader.

Picks the right per-format extractor based on :class:`SourceKind` and
returns plain text. All extractors below catch their format-specific
errors and re-raise :class:`SourceLoadError` so the pipeline has a
single exception type to handle.
"""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from ..types import Source, SourceKind
from .epub_loader import load_epub
from .html_loader import load_html
from .markdown_loader import load_markdown
from .pdf_loader import load_pdf
from .url_loader import load_url

log = logging.getLogger(__name__)


class SourceLoadError(RuntimeError):
    """Raised when a source cannot be parsed into text."""


def load_source(source: Source) -> str:
    """Return the plain text of ``source``.

    The dispatch table is a simple match on :class:`SourceKind`.
    Adding a new format means writing a new ``<format>_loader.py`` and
    extending this match.
    """
    try:
        if source.kind is SourceKind.PDF:
            return load_pdf(source.path)
        if source.kind is SourceKind.EPUB:
            return load_epub(source.path)
        if source.kind is SourceKind.MARKDOWN:
            return load_markdown(source.path)
        if source.kind is SourceKind.HTML:
            return load_html(source.path)
        if source.kind is SourceKind.TEXT:
            return Path(source.path).read_text(encoding="utf-8")
        if source.kind is SourceKind.URL:
            return load_url(source.path)
    except SourceLoadError:
        raise
    except Exception as exc:
        raise SourceLoadError(f"could not load {source.path!r}: {exc}") from exc
    raise SourceLoadError(f"unknown source kind {source.kind!r}")


def detect_kind(path_or_url: str) -> SourceKind:
    """Heuristic detection of a source's kind from its path or URL.

    For URLs, returns :attr:`SourceKind.URL` unconditionally; the URL
    loader will then detect HTML / PDF / Markdown at fetch time.
    """
    if path_or_url.startswith(("http://", "https://")):
        return SourceKind.URL
    p = Path(path_or_url)
    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return SourceKind.PDF
    if suffix in {".epub"}:
        return SourceKind.EPUB
    if suffix in {".md", ".markdown"}:
        return SourceKind.MARKDOWN
    if suffix in {".html", ".htm"}:
        return SourceKind.HTML
    if suffix in {".txt", ".rst", ""}:
        return SourceKind.TEXT
    mt, _ = mimetypes.guess_type(path_or_url)
    if mt:
        if mt.startswith("text/html"):
            return SourceKind.HTML
        if mt.startswith("text/markdown"):
            return SourceKind.MARKDOWN
        if mt == "application/pdf":
            return SourceKind.PDF
    log.warning("could not infer source kind for %s; falling back to plain text", path_or_url)
    return SourceKind.TEXT
