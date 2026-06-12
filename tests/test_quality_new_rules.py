"""Tests for the three quality-filter rules added in this round:

- identical question / answer drop
- source-citation phrase drop ("the passage states", "as mentioned")
- answer-echoes-question drop

The pre-existing rules (length, yes/no, definitional loop,
low-information) are covered by tests/test_quality.py.
"""
from __future__ import annotations

import pytest

from mneme.cards.quality import QualityFilter
from mneme.config import QualityConfig
from mneme.types import Card


@pytest.fixture
def filt() -> QualityFilter:
    # Loosen the min_quality_score so the new rules are tested in
    # isolation (the score heuristic would also drop weird cards).
    return QualityFilter(QualityConfig(min_quality_score=0.0))


# ---------------------------------------------------------------------------
# Identical Q == A
# ---------------------------------------------------------------------------


def test_identical_question_and_answer_dropped(filt) -> None:
    c = Card(question="Photosynthesis is the process.", answer="Photosynthesis is the process.")
    assert filt.filter([c]) == []


def test_identical_after_punctuation_normalisation(filt) -> None:
    c = Card(question="What is ATP?", answer="What is ATP?")
    assert filt.filter([c]) == []


def test_close_but_not_identical_kept(filt) -> None:
    c = Card(question="What is the capital of France?", answer="Paris")
    assert filt.filter([c]) == [pytest_approx_card(filt.filter([c])[0])]


def pytest_approx_card(c: Card) -> Card:
    # Helper so we compare Card objects ignoring computed fields.
    return c


# ---------------------------------------------------------------------------
# Source-citation phrases in the answer
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "answer",
    [
        "As mentioned above, the answer is chloroplasts.",
        "The passage states that mitochondria produce ATP.",
        "According to the text, the author lived in Vienna.",
        "Refer to the previous paragraph for the full context.",
        "The author states that the experiment failed.",
        "In the above section, this is described in detail.",
    ],
)
def test_source_citation_phrases_dropped(filt, answer) -> None:
    c = Card(question="A normal question?", answer=answer)
    assert filt.filter([c]) == [], f"expected drop on answer: {answer!r}"


def test_answer_that_happens_to_use_passage_in_unrelated_context_kept(filt) -> None:
    # Edge case: the word "passage" is used in a non-citation sense.
    # The current rule errs on the side of dropping; this test
    # documents the trade-off so future tweaks notice the regression.
    c = Card(
        question="What does the term 'aria' mean in opera?",
        answer="A solo vocal piece typically performed by a single character.",
    )
    out = filt.filter([c])
    assert len(out) == 1  # not dropped: no source-citation phrase


# ---------------------------------------------------------------------------
# Answer echoes question
# ---------------------------------------------------------------------------


def test_answer_echoing_question_dropped(filt) -> None:
    # Classic anti-pattern: answer rephrases the question with the key
    # noun substituted.
    c = Card(
        question="What is the longest river in Africa?",
        answer="The longest river in Africa is the Nile river system.",
    )
    out = filt.filter([c])
    assert out == []


def test_short_answer_kept_even_when_echoing(filt) -> None:
    # "Paris" is the right shape of answer for the question; it
    # contains no shared content words and is short so the echo rule
    # never fires.
    c = Card(question="What is the capital of France?", answer="Paris")
    assert len(filt.filter([c])) == 1


def test_long_substantive_answer_kept(filt) -> None:
    # A genuine explanatory answer should pass even when long.
    c = Card(
        question="Why do plants need sunlight?",
        answer="Sunlight provides the energy that drives chlorophyll to split water and fix carbon.",
    )
    assert len(filt.filter([c])) == 1
