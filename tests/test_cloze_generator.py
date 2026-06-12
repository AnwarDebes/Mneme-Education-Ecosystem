"""Tests for cloze-mode card generation.

When ``GeneratorConfig.card_type == 'cloze'`` the :class:`CardGenerator`
asks the LLM for cloze-deletion sentences instead of Q/A pairs and
ships them with the cloze markers intact in ``Card.question``.
"""
from __future__ import annotations

import json

from mneme.cards.generator import CardGenerator, _extract_cloze_terms
from mneme.config import GeneratorConfig
from mneme.llm.backend import MockBackend
from mneme.types import AtomicFact


def test_extract_cloze_terms_returns_visible_text() -> None:
    text = "Mitochondria produce {{c1::ATP}} via {{c2::cellular respiration}}."
    assert _extract_cloze_terms(text) == ["ATP", "cellular respiration"]


def test_extract_cloze_terms_handles_hint_syntax() -> None:
    # Anki cloze syntax allows {{c1::answer::hint}}; the hint must not
    # leak into the visible-term list.
    text = "{{c1::Paris::capital}} is in {{c2::France}}."
    assert _extract_cloze_terms(text) == ["Paris", "France"]


def test_cloze_generator_emits_cards_with_markers() -> None:
    fact = AtomicFact(
        fact="Mitochondria produce ATP via cellular respiration.",
        source_chunk=0,
        confidence=0.9,
    )
    mock = MockBackend(
        responses=[
            json.dumps(
                [
                    {
                        "cloze": "Mitochondria produce {{c1::ATP}} via {{c2::cellular respiration}}.",
                        "tags": ["biology"],
                    }
                ]
            )
        ]
    )
    config = GeneratorConfig(card_type="cloze", max_cards_per_fact=2)
    cards = CardGenerator(mock, config).generate([fact])
    assert len(cards) == 1
    assert "{{c1::ATP}}" in cards[0].question
    # The answer is a fallback summary listing the deleted terms.
    assert "ATP" in cards[0].answer
    assert cards[0].source_fact == fact.fact


def test_cloze_generator_drops_cards_without_markers() -> None:
    fact = AtomicFact(fact="some fact", source_chunk=0, confidence=0.9)
    mock = MockBackend(
        responses=[
            json.dumps(
                [
                    {"cloze": "Sentence without any markers."},
                    {"cloze": "Mitochondria produce {{c1::ATP}}."},
                ]
            )
        ]
    )
    config = GeneratorConfig(card_type="cloze")
    cards = CardGenerator(mock, config).generate([fact])
    assert len(cards) == 1
    assert "{{c1::ATP}}" in cards[0].question


def test_basic_mode_is_unchanged_by_cloze_addition() -> None:
    """Adding cloze support must not regress the basic path."""
    fact = AtomicFact(fact="Paris is the capital of France.", source_chunk=0, confidence=0.9)
    mock = MockBackend(
        responses=[
            json.dumps([{"question": "What is the capital of France?", "answer": "Paris"}])
        ]
    )
    config = GeneratorConfig(card_type="basic")
    cards = CardGenerator(mock, config).generate([fact])
    assert len(cards) == 1
    assert cards[0].question == "What is the capital of France?"
    assert cards[0].answer == "Paris"
