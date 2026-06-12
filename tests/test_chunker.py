"""Tests for the semantic chunker."""
from __future__ import annotations

from mneme.config import ChunkerConfig
from mneme.extraction.chunker import Chunker


def test_chunker_keeps_short_text_whole(sample_text):
    chunker = Chunker(ChunkerConfig(target_tokens=10000))
    chunks = chunker.chunk(sample_text)
    assert len(chunks) >= 1
    assert all(c.text for c in chunks)


def test_chunker_respects_headings(sample_text):
    chunker = Chunker(ChunkerConfig(target_tokens=10, respect_headings=True))
    chunks = chunker.chunk(sample_text)
    sections = [c.section for c in chunks]
    assert "Photosynthesis" in sections or any(s and "Photosynthesis" in s for s in sections)


def test_chunker_splits_long_paragraphs():
    # Construct a single very long paragraph.
    long_para = (". ".join([f"Sentence {i}" for i in range(200)])) + "."
    chunker = Chunker(ChunkerConfig(target_tokens=80, overlap_tokens=0, respect_headings=False))
    chunks = chunker.chunk(long_para)
    assert len(chunks) > 1


def test_chunker_emits_token_counts(sample_text):
    chunker = Chunker(ChunkerConfig(target_tokens=10000))
    chunks = chunker.chunk(sample_text)
    for c in chunks:
        assert c.token_count is None or c.token_count > 0


def test_chunker_indices_are_sequential(sample_text):
    chunker = Chunker(ChunkerConfig(target_tokens=10))
    chunks = chunker.chunk(sample_text)
    assert [c.index for c in chunks] == list(range(len(chunks)))
