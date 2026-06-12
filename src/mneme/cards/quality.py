"""Heuristic quality filter.

A list of cheap checks that drop the worst LLM outputs without
incurring a second LLM round-trip. The optional LLM-based quality
check (slow, expensive) lives in :mod:`mneme.cards.llm_quality` and
is off by default.

Each rule is a function ``(card) -> issue_or_None`` so adding or
removing a rule is one line. The filter logs every rejection with
its reason for debugging.
"""
from __future__ import annotations

import logging
import re
from collections.abc import Callable

from ..config import QualityConfig
from ..types import Card

log = logging.getLogger(__name__)


_YES_NO_PREFIXES = (
    "is ", "are ", "was ", "were ", "do ", "does ", "did ",
    "can ", "could ", "will ", "would ", "should ", "has ", "have ", "had ",
)

# Phrases that indicate the answer is referring to context the studier
# will not have on the back of the card. A card whose answer says "as
# mentioned above" or "the passage states" is a card the LLM wrote
# while pretending the source was still visible.
_SOURCE_CITATION_PATTERNS = (
    re.compile(r"\b(as|like)\s+(mentioned|noted|stated|described|shown|seen|discussed)\s+(above|previously|earlier)\b", re.IGNORECASE),
    re.compile(r"\b(the|this|that)\s+(passage|paragraph|text|excerpt|article|chapter|source|document|reading|section)\b", re.IGNORECASE),
    re.compile(r"\baccording\s+to\s+the\s+(passage|paragraph|text|article|chapter|source|document|reading|section|author)\b", re.IGNORECASE),
    re.compile(r"\b(refer|see|cf\.?)\s+to\s+(the|above|previous|prior)\b", re.IGNORECASE),
    re.compile(r"\b(the\s+)?author\s+(states|writes|says|claims|notes|argues|mentions)\b", re.IGNORECASE),
    re.compile(r"\bin\s+the\s+(above|preceding|previous|provided)\b", re.IGNORECASE),
)

# Stopwords excluded when measuring lexical overlap between question
# and answer. The list is short on purpose; long stopword lists tend
# to over-fit a particular corpus.
_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "of", "in", "on", "at", "by", "to", "for", "from", "with", "without",
    "and", "or", "but", "not", "no", "this", "that", "these", "those",
    "it", "its", "as", "if", "than", "then", "so", "such", "do", "does",
    "did", "has", "have", "had", "can", "could", "will", "would", "should",
})


class QualityFilter:
    """Drop low-quality cards.

    The constructor takes a :class:`QualityConfig` and assembles a
    rule list. Call :meth:`filter` with a list of cards; cards that
    fail any rule are dropped (and logged at DEBUG level).
    """

    def __init__(self, config: QualityConfig | None = None) -> None:
        self.config = config or QualityConfig()
        self._rules: list[Callable[[Card], str | None]] = [
            self._length_check,
            self._identical_qa_check,
            self._definitional_loop_check,
            self._yes_no_check,
            self._low_information_check,
            self._source_citation_check,
            self._answer_echoes_question_check,
        ]

    def filter(self, cards: list[Card]) -> list[Card]:
        kept: list[Card] = []
        for card in cards:
            issue = None
            for rule in self._rules:
                issue = rule(card)
                if issue is not None:
                    break
            if issue:
                log.debug("dropping card %r: %s", card.question[:60], issue)
                continue
            # Compute a simple heuristic quality score.
            card_with_score = card.model_copy(update={"quality_score": self._score(card)})
            if card_with_score.quality_score is not None and card_with_score.quality_score < self.config.min_quality_score:
                log.debug("dropping card %r: score %.2f < min %.2f",
                          card.question[:60], card_with_score.quality_score, self.config.min_quality_score)
                continue
            kept.append(card_with_score)
        log.info("quality filter kept %d / %d cards", len(kept), len(cards))
        return kept

    # ------------------------------------------------------------------
    # Rules
    # ------------------------------------------------------------------
    def _length_check(self, card: Card) -> str | None:
        if len(card.question) < self.config.min_question_chars:
            return f"question too short ({len(card.question)} chars)"
        if len(card.answer) < self.config.min_answer_chars:
            return f"answer too short ({len(card.answer)} chars)"
        if len(card.question) > self.config.max_question_chars:
            return f"question too long ({len(card.question)} chars)"
        if len(card.answer) > self.config.max_answer_chars:
            return f"answer too long ({len(card.answer)} chars)"
        return None

    def _definitional_loop_check(self, card: Card) -> str | None:
        """Reject Q: 'what is X?' A: 'X is ...'."""
        if not self.config.drop_definitional_loops:
            return None
        q = card.question.lower().strip().rstrip("?")
        a = card.answer.lower().strip().rstrip(".")
        if q.startswith("what is "):
            subj = q[len("what is "):].strip()
            if subj and a.startswith(subj):
                return f"definitional loop on {subj!r}"
        if q.startswith("what are "):
            subj = q[len("what are "):].strip()
            if subj and a.startswith(subj):
                return f"definitional loop on {subj!r}"
        return None

    def _yes_no_check(self, card: Card) -> str | None:
        if not self.config.drop_yes_no:
            return None
        q = card.question.lower().lstrip()
        for p in _YES_NO_PREFIXES:
            if q.startswith(p):
                a = card.answer.lower().strip().rstrip(".!")
                if a in {"yes", "no", "true", "false"}:
                    return "yes/no card"
        return None

    def _low_information_check(self, card: Card) -> str | None:
        if not self.config.drop_low_information:
            return None
        # Single-word answers can be fine ("Paris"). Empty / whitespace-only
        # answers, or "n/a", are not.
        a = card.answer.strip().lower()
        if a in {"", "n/a", "na", "none", "unknown", "?", "-"}:
            return f"low-information answer {a!r}"
        return None

    def _identical_qa_check(self, card: Card) -> str | None:
        """Reject cards where the question and answer are the same string
        (modulo case, whitespace, and trailing punctuation). The LLM
        sometimes emits the same sentence twice and the result is
        always useless."""
        normalised_q = re.sub(r"[\s\W]+", " ", card.question.lower()).strip()
        normalised_a = re.sub(r"[\s\W]+", " ", card.answer.lower()).strip()
        if normalised_q and normalised_q == normalised_a:
            return "question is identical to answer"
        return None

    def _source_citation_check(self, card: Card) -> str | None:
        """Reject cards whose answer references the source by name
        ('the passage states', 'as mentioned above'). The studier will
        not have the source in front of them on the back of the card."""
        for pattern in _SOURCE_CITATION_PATTERNS:
            m = pattern.search(card.answer)
            if m:
                return f"answer cites the source ({m.group(0)!r})"
        return None

    def _answer_echoes_question_check(self, card: Card) -> str | None:
        """Reject cards where the answer is the question with one word
        substituted. The pattern is: "What is the longest river in
        Africa?" -> "The longest river in Africa is the Nile." Such
        cards do not test recall; they test reading the prompt.

        Concretely: if the answer is at least 6 words and at least 80%
        of its content tokens (excluding stopwords) also appear in the
        question, the card is an echo.
        """
        a_tokens = [t for t in _word_tokens(card.answer.lower()) if t not in _STOPWORDS]
        if len(a_tokens) < 6:
            return None  # short answers are fine
        q_tokens = set(t for t in _word_tokens(card.question.lower()) if t not in _STOPWORDS)
        if not q_tokens:
            return None
        overlap = sum(1 for t in a_tokens if t in q_tokens)
        ratio = overlap / len(a_tokens)
        if ratio >= 0.8:
            return f"answer echoes the question (overlap {ratio:.0%})"
        return None

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------
    def _score(self, card: Card) -> float:
        """Heuristic 0..1 quality score.

        Weights: question well-formed (1 point), answer concise (1),
        answer is not a single function word (1), question contains a
        wh-word (1). Normalised to [0, 1].
        """
        score = 0.0
        weight = 4.0
        if card.question.strip().endswith("?"):
            score += 1.0
        if 1 <= len(card.answer.split()) <= 25:
            score += 1.0
        if card.answer.lower() not in {"the", "a", "an", "yes", "no", "it"}:
            score += 1.0
        if re.search(r"^(what|when|where|who|why|how|which|name|list)\b", card.question.lower()):
            score += 1.0
        return score / weight


_TOKEN_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")


def _word_tokens(text: str) -> list[str]:
    """Return lowercase word tokens (no punctuation, no whitespace)."""
    return _TOKEN_RE.findall(text)
