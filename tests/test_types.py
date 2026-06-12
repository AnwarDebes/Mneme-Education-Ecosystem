"""Tests for the core data model."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from mneme.types import AtomicFact, Card, CardDifficulty, Chunk, Source, SourceKind


def test_source_kind_enum_values():
    assert SourceKind.PDF.value == "pdf"
    assert SourceKind.URL.value == "url"


def test_source_is_frozen():
    s = Source(kind=SourceKind.TEXT, path="x.txt")
    with pytest.raises((TypeError, ValidationError)):
        s.path = "other"


def test_atomicfact_rejects_empty_fact():
    with pytest.raises(ValidationError):
        AtomicFact(fact="", source_chunk=0)


def test_atomicfact_clamps_confidence():
    with pytest.raises(ValidationError):
        AtomicFact(fact="x is y", source_chunk=0, confidence=1.5)


def test_card_validates_length():
    c = Card(question="What is X?", answer="Y")
    assert c.tags == []
    assert c.difficulty is None


def test_card_difficulty_enum():
    c = Card(question="What is X?", answer="Y", difficulty=CardDifficulty.HARD)
    assert c.difficulty is CardDifficulty.HARD


def test_chunk_carries_provenance():
    c = Chunk(index=0, text="hello", char_start=0, char_end=5)
    assert c.char_end == 5
