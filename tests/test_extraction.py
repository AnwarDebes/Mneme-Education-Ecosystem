"""Tests for the source loaders and the loader dispatcher."""
from __future__ import annotations

import pytest

from mneme.extraction import detect_kind, load_source
from mneme.types import Source, SourceKind


def test_detect_kind_url():
    assert detect_kind("https://example.com") is SourceKind.URL


def test_detect_kind_pdf():
    assert detect_kind("/some/path/textbook.pdf") is SourceKind.PDF


def test_detect_kind_markdown():
    assert detect_kind("notes.md") is SourceKind.MARKDOWN


def test_detect_kind_unknown_falls_back_to_text():
    assert detect_kind("notes.xyz") is SourceKind.TEXT


def test_load_text_source(tmp_path):
    p = tmp_path / "x.txt"
    p.write_text("hello world", encoding="utf-8")
    source = Source(kind=SourceKind.TEXT, path=str(p))
    assert load_source(source) == "hello world"


def test_load_markdown_source(tmp_text_file):
    source = Source(kind=SourceKind.MARKDOWN, path=str(tmp_text_file))
    text = load_source(source)
    assert "Photosynthesis" in text
    assert "chloroplasts" in text


def test_unknown_source_kind_raises():
    from mneme.extraction.loader import SourceLoadError

    source = Source(kind=SourceKind.TEXT, path="/nonexistent/path")
    with pytest.raises(SourceLoadError):
        load_source(source)
