"""Tests for the heuristic quality filter."""
from __future__ import annotations

from mneme.cards.quality import QualityFilter
from mneme.config import QualityConfig
from mneme.types import Card


def _f() -> QualityFilter:
    return QualityFilter()


def test_keeps_well_formed_card():
    c = Card(question="What is the capital of France?", answer="Paris")
    out = _f().filter([c])
    assert len(out) == 1
    assert out[0].quality_score is not None and out[0].quality_score > 0.5


def test_drops_definitional_loop():
    c = Card(question="What is X?", answer="X is a thing.")
    out = _f().filter([c])
    assert out == []


def test_drops_yes_no():
    c = Card(question="Is Paris in France?", answer="Yes")
    out = _f().filter([c])
    assert out == []


def test_drops_empty_answer():
    c = Card(question="Where is Paris?", answer="N/A")
    out = _f().filter([c])
    assert out == []


def test_respects_max_length():
    cfg = QualityConfig(max_answer_chars=100)
    # The Card model itself rejects answers longer than 600 chars,
    # so first check the QualityFilter on a 200-char answer in a config
    # that caps at 100.
    c = Card(question="What is foo?", answer="x" * 200)
    out = QualityFilter(cfg).filter([c])
    assert out == []
