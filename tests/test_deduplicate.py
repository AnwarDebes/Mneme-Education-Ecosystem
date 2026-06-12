"""Tests for the de-duplicator with the TF-IDF fallback backend."""
from __future__ import annotations

from mneme.cards.deduplicate import Deduplicator
from mneme.config import EmbeddingConfig
from mneme.embedding.fallback import TFIDFFallback
from mneme.types import Card


def _dedup(cards, threshold=0.85):
    cfg = EmbeddingConfig(backend="tfidf-fallback", dedup_threshold=threshold)
    return Deduplicator(TFIDFFallback(), cfg).dedup(cards)


def test_dedup_keeps_distinct_cards():
    cards = [
        Card(question="What is the capital of France?", answer="Paris"),
        Card(question="What is the capital of Germany?", answer="Berlin"),
    ]
    out = _dedup(cards)
    assert len(out) == 2


def test_dedup_collapses_paraphrases_with_low_threshold():
    cards = [
        Card(question="What is the capital of France?", answer="Paris"),
        Card(question="What is France's capital?", answer="Paris"),
    ]
    out = _dedup(cards, threshold=0.3)
    assert len(out) == 1


def test_dedup_does_not_collapse_above_threshold():
    cards = [
        Card(question="What is the capital of France?", answer="Paris"),
        Card(question="What is France's capital?", answer="Paris"),
    ]
    out = _dedup(cards, threshold=0.99)
    assert len(out) == 2


def test_dedup_falls_back_to_exact_when_backend_errors():
    class BrokenBackend:
        def embed(self, texts):
            raise RuntimeError("nope")

    cfg = EmbeddingConfig(backend="tfidf-fallback")
    d = Deduplicator(BrokenBackend(), cfg)
    cards = [
        Card(question="What is X?", answer="A"),
        Card(question="what is x?", answer="A"),
        Card(question="What is Y?", answer="B"),
    ]
    out = d.dedup(cards)
    assert len(out) == 2
