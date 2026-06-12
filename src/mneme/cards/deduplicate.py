"""Semantic de-duplication of cards.

Cosine similarity on question embeddings is the right tool for "is
this card a duplicate". Two cards are duplicates iff their question
embeddings are close (above ``dedup_threshold``). The deduplicator
keeps the higher-quality member of each duplicate cluster (or the
first, when quality is tied).

The embedding backend is a Protocol so tests can pass a
deterministic stub.
"""
from __future__ import annotations

import logging
from typing import Protocol

import numpy as np

from ..config import EmbeddingConfig
from ..types import Card

log = logging.getLogger(__name__)


class EmbeddingBackend(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray:
        ...


class Deduplicator:
    """Remove near-duplicate cards using cosine similarity on question embeddings."""

    def __init__(self, backend: EmbeddingBackend, config: EmbeddingConfig | None = None) -> None:
        self.backend = backend
        self.config = config or EmbeddingConfig()

    def dedup(self, cards: list[Card]) -> list[Card]:
        if not cards:
            return cards
        if len(cards) > self.config.max_cards_to_compare:
            log.warning(
                "dedup capped at %d cards (input had %d); excess kept without dedup",
                self.config.max_cards_to_compare, len(cards),
            )
            head = cards[: self.config.max_cards_to_compare]
            tail = cards[self.config.max_cards_to_compare :]
            return self._dedup_batch(head) + tail
        return self._dedup_batch(cards)

    def _dedup_batch(self, cards: list[Card]) -> list[Card]:
        questions = [c.question for c in cards]
        try:
            vecs = self.backend.embed(questions)
        except Exception as exc:
            log.warning("embedding backend failed (%s); falling back to exact-match dedup", exc)
            return _exact_dedup(cards)
        vecs = _l2_normalise(np.asarray(vecs, dtype=np.float32))
        sims = vecs @ vecs.T

        # Greedy: for each card in order, drop it if it is too similar
        # to any earlier-kept card.
        keep_mask = np.ones(len(cards), dtype=bool)
        for i in range(len(cards)):
            if not keep_mask[i]:
                continue
            for j in range(i + 1, len(cards)):
                if not keep_mask[j]:
                    continue
                if sims[i, j] >= self.config.dedup_threshold:
                    # Keep the higher-quality member.
                    qi = cards[i].quality_score or 0.0
                    qj = cards[j].quality_score or 0.0
                    if qj > qi:
                        keep_mask[i] = False
                        break
                    keep_mask[j] = False
        kept = [c for c, k in zip(cards, keep_mask, strict=True) if k]
        log.info("dedup kept %d / %d cards", len(kept), len(cards))
        return kept


def _l2_normalise(vecs: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return vecs / norms


def _exact_dedup(cards: list[Card]) -> list[Card]:
    """Fallback: drop cards whose question is byte-identical (case-insensitive) to a kept card."""
    seen: set[str] = set()
    kept: list[Card] = []
    for c in cards:
        key = c.question.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        kept.append(c)
    return kept
