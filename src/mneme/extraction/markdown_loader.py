"""Markdown extractor.

Markdown is already text. We render it to HTML via ``markdown-it-py``
and then strip the HTML so footnotes, tables, and image alt-text end
up as readable plain text. This way the chunker downstream sees the
same surface form regardless of input format.
"""
from __future__ import annotations

from pathlib import Path


def load_markdown(path: str) -> str:
    try:
        from bs4 import BeautifulSoup
        from markdown_it import MarkdownIt
    except ImportError as exc:
        raise RuntimeError(
            "markdown-it-py + beautifulsoup4 are required for Markdown loading. "
            "pip install markdown-it-py beautifulsoup4"
        ) from exc

    md = MarkdownIt("commonmark", {"breaks": True, "linkify": False})
    raw = Path(path).read_text(encoding="utf-8")
    html = md.render(raw)
    soup = BeautifulSoup(html, "html.parser")
    # Keep headings on their own line so the chunker can spot them.
    for h in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        h.insert_before("\n")
        h.insert_after("\n")
    return soup.get_text(separator="\n").strip()
