"""Tests for the heuristic difficulty classifier and feature extractor."""
from __future__ import annotations

from mneme.difficulty.features import extract_features
from mneme.difficulty.heuristic import HeuristicDifficulty
from mneme.types import Card, CardDifficulty


def test_features_basic():
    c = Card(question="What is the boiling point of water?", answer="100 degrees Celsius")
    f = extract_features(c)
    assert f.question_starts_with_wh is True
    assert f.has_number is True
    assert f.answer_is_phrase is True or f.answer_is_sentence is True


def test_heuristic_rates_short_factual_as_easy():
    c = Card(question="What is the capital of France?", answer="Paris")
    out = HeuristicDifficulty().score(c)
    assert out.difficulty in {CardDifficulty.EASY, CardDifficulty.MEDIUM}


def test_heuristic_rates_complex_as_hard():
    c = Card(
        question="Why does Newton's third law not strictly apply to electromagnetic interactions between two moving charges in special relativity?",
        answer="Because the action and reaction are not simultaneous; momentum is also carried by the electromagnetic field.",
    )
    out = HeuristicDifficulty().score(c)
    assert out.difficulty is CardDifficulty.HARD
    assert "sentence-length answer" in (out.difficulty_rationale or "")
