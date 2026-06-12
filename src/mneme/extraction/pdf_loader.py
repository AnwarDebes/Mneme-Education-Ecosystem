"""PDF extractor.

Uses ``pypdf`` (the maintained successor to PyPDF2). For most
educational PDFs the per-page text-extraction is sufficient; we
concatenate pages with a form-feed (\\x0c) so the chunker can later
respect page boundaries when it wants to.
"""
from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger(__name__)


def load_pdf(path: str) -> str:
    """Return the plain text of a PDF file."""
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("pypdf is required for PDF loading. pip install pypdf>=4.0") from exc

    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    reader = PdfReader(str(p))
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("page %d of %s failed to extract: %s", i, path, exc)
            text = ""
        parts.append(text.strip())
    return "\n\f\n".join(parts)
