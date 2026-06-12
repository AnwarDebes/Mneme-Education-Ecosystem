"""URL extractor.

Fetches a URL with a polite user-agent string and a generous timeout,
then dispatches based on the response Content-Type.
"""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

import requests

log = logging.getLogger(__name__)

_USER_AGENT = "mneme/0.1 (+https://github.com/AnwarDebes/Mneme-Education-Ecosystem) python-requests"


def load_url(url: str, timeout_s: float = 30.0) -> str:
    """Fetch ``url`` and extract its text."""
    resp = requests.get(url, headers={"User-Agent": _USER_AGENT}, timeout=timeout_s)
    resp.raise_for_status()
    ct = resp.headers.get("Content-Type", "").lower()
    if "pdf" in ct or url.lower().endswith(".pdf"):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(resp.content)
            tmp = Path(f.name)
        from .pdf_loader import load_pdf

        try:
            return load_pdf(str(tmp))
        finally:
            tmp.unlink(missing_ok=True)
    if "html" in ct or "<html" in resp.text[:500].lower():
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator="\n").strip()
    # Fallback: assume plain text.
    return resp.text
