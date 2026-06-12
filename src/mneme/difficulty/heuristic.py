"""Heuristic difficulty classifier.

A handwritten rules engine that gives every card a difficulty class
plus a human-readable rationale string. Defaults are calibrated for
educational content (medical, legal, language, software certification)
based on what makes a card hard for a human:

* Numerical reasoning (precise numbers in the answer) -> harder.
* Multiple named entities in the question -> harder.
* Long sentence answers -> harder than single-word answers.
* Negation in question -> harder (reading-comprehension trap).
* Listing answers -> harder than single-fact answers.

The rules can be overridden via the constructor. They are documented
in :mod:`mneme.difficulty.features`.
"""
from __future__ import annotations

import logging

from ..types import Card, CardDifficulty
from .features import CardFeatures, extract_features

log = logging.getLogger(__name__)


class HeuristicDifficulty:
    """Rule-based difficulty scorer.

    Each rule contributes a small integer weight to the running score.
    The thresholds at the bottom map the running score to easy /
    medium / hard. The :attr:`rationale` field on the returned card
    lists every rule that fired.
    """

    def __init__(
        self,
        hard_threshold: int = 4,
        medium_threshold: int = 2,
    ) -> None:
        self.hard_threshold = hard_threshold
        self.medium_threshold = medium_threshold

    def score(self, card: Card) -> Card:
        features = extract_features(card)
        score, reasons = self._score_features(features)
        difficulty = self._bucket(score)
        return card.model_copy(
            update={
                "difficulty": difficulty,
                "difficulty_rationale": "; ".join(reasons) if reasons else "no flagged complexity",
            }
        )

    def score_many(self, cards: list[Card]) -> list[Card]:
        return [self.score(c) for c in cards]

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _score_features(self, f: CardFeatures) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []

        if f.has_number and f.number_count >= 2:
            score += 2
            reasons.append("multiple numeric values")
        elif f.has_number:
            score += 1
            reasons.append("contains a number")

        if f.named_entity_count >= 3:
            score += 2
            reasons.append("three or more named entities")
        elif f.has_named_entity:
            score += 1
            reasons.append("contains a named entity")

        if f.has_negation:
            score += 1
            reasons.append("contains negation")

        if f.answer_is_sentence:
            score += 2
            reasons.append("sentence-length answer")
        elif f.answer_is_phrase:
            score += 1
            reasons.append("multi-word answer")

        if f.question_is_long:
            score += 1
            reasons.append("long question")

        if f.requires_listing:
            score += 1
            reasons.append("answer requires listing items")

        return score, reasons

    def _bucket(self, score: int) -> CardDifficulty:
        if score >= self.hard_threshold:
            return CardDifficulty.HARD
        if score >= self.medium_threshold:
            return CardDifficulty.MEDIUM
        return CardDifficulty.EASY
