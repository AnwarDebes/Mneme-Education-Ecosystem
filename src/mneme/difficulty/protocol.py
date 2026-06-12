"""Difficulty classifier protocol."""
from __future__ import annotations

from typing import Protocol

from ..types import Card


class DifficultyClassifier(Protocol):
    """Tag a card with a difficulty level and a human-readable rationale."""

    def score(self, card: Card) -> Card:
        ...

    def score_many(self, cards: list[Card]) -> list[Card]:
        ...
