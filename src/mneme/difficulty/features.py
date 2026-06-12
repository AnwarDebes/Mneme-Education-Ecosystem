"""Card-level features used by the difficulty classifier.

The features are deliberately compact and interpretable so a Tsetlin
Machine clause can refer to them by name ("question_has_numbers AND
answer_word_count_ge_5"). Adding a new feature is one entry below.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..types import Card

_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?(?:%|°|kg|km|mg|ml|m|s)?\b")
_NAMED_ENTITY_RE = re.compile(r"\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b")
_NEGATION_TOKENS = {"not", "never", "no", "without", "neither", "nor", "cannot"}


@dataclass(frozen=True)
class CardFeatures:
    """Per-card features used by every difficulty backend.

    The binary fields are what the Tsetlin Machine reads. The integer
    fields are used by the heuristic backend (and surfaced to users
    who want to inspect the rationale).
    """

    # Integer features (for heuristics and feature engineering)
    question_word_count: int
    answer_word_count: int
    question_char_count: int
    answer_char_count: int
    number_count: int
    named_entity_count: int
    negation_count: int

    # Binary literals (for the TM)
    has_number: bool
    has_named_entity: bool
    has_negation: bool
    answer_is_single_word: bool
    answer_is_phrase: bool                  # 2-5 words
    answer_is_sentence: bool                # > 5 words
    question_starts_with_wh: bool
    question_is_long: bool                  # > 15 words
    requires_listing: bool                  # answer contains "," or ";"

    # Free-form tags (for debugging only)
    debug_tags: list[str] = field(default_factory=list)

    def to_binary_vector(self) -> list[int]:
        """Return the binary literals as a 0/1 vector for the TM."""
        return [
            int(self.has_number),
            int(self.has_named_entity),
            int(self.has_negation),
            int(self.answer_is_single_word),
            int(self.answer_is_phrase),
            int(self.answer_is_sentence),
            int(self.question_starts_with_wh),
            int(self.question_is_long),
            int(self.requires_listing),
        ]

    @staticmethod
    def feature_names() -> list[str]:
        return [
            "has_number",
            "has_named_entity",
            "has_negation",
            "answer_is_single_word",
            "answer_is_phrase",
            "answer_is_sentence",
            "question_starts_with_wh",
            "question_is_long",
            "requires_listing",
        ]


def extract_features(card: Card) -> CardFeatures:
    """Compute :class:`CardFeatures` for one card."""
    q = card.question.strip()
    a = card.answer.strip()
    q_words = _tokens(q)
    a_words = _tokens(a)

    number_count = len(_NUMBER_RE.findall(q)) + len(_NUMBER_RE.findall(a))
    named_entity_count = len(_NAMED_ENTITY_RE.findall(q)) + len(_NAMED_ENTITY_RE.findall(a))
    negation_count = sum(1 for w in q_words + a_words if w.lower() in _NEGATION_TOKENS)

    return CardFeatures(
        question_word_count=len(q_words),
        answer_word_count=len(a_words),
        question_char_count=len(q),
        answer_char_count=len(a),
        number_count=number_count,
        named_entity_count=named_entity_count,
        negation_count=negation_count,
        has_number=number_count > 0,
        has_named_entity=named_entity_count > 0,
        has_negation=negation_count > 0,
        answer_is_single_word=len(a_words) == 1,
        answer_is_phrase=2 <= len(a_words) <= 5,
        answer_is_sentence=len(a_words) > 5,
        question_starts_with_wh=q.lower().startswith(
            ("what ", "when ", "where ", "who ", "why ", "how ", "which ", "name ", "list ")
        ),
        question_is_long=len(q_words) > 15,
        requires_listing="," in a or ";" in a,
        debug_tags=[],
    )


_TOKEN_RE = re.compile(r"\b[\w'-]+\b")


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text)
