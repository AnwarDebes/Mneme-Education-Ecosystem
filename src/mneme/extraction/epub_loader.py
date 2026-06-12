"""EPUB extractor.

Uses ``ebooklib`` to walk the spine and ``BeautifulSoup`` to strip
HTML structure to plain text. Chapters are joined with a form-feed
so the chunker can optionally respect chapter boundaries.
"""
from __future__ import annotations

from pathlib import Path


def load_epub(path: str) -> str:
    try:
        from bs4 import BeautifulSoup
        from ebooklib import ITEM_DOCUMENT, epub
    except ImportError as exc:
        raise RuntimeError(
            "ebooklib + beautifulsoup4 are required for EPUB loading. "
            "pip install ebooklib beautifulsoup4"
        ) from exc

    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    book = epub.read_epub(str(p))
    chapters: list[str] = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        html = item.get_content().decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav"]):
            tag.decompose()
        text = soup.get_text(separator="\n").strip()
        if text:
            chapters.append(text)
    return "\n\f\n".join(chapters)
