"""Tsetlin Machine difficulty classifier.

Optional interpretable backend. Trained from per-card labels
(``easy / medium / hard``) supplied by the user via the ``mneme train``
subcommand or programmatically. At inference time it produces both
a class and a human-readable rationale that lists the firing clauses
in plain English.

The implementation wraps ``tmu.models.classification.vanilla_classifier.TMClassifier``
to keep dependencies minimal. Heavier variants (CoalescedTM, GraphTM)
are out of scope for this v0.1 module; if the user wants the full
interpretability story, the HGTM library handles that separately.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from ..config import DifficultyConfig
from ..types import Card, CardDifficulty
from .features import CardFeatures, extract_features

log = logging.getLogger(__name__)


_LABEL_TO_ID = {
    CardDifficulty.EASY: 0,
    CardDifficulty.MEDIUM: 1,
    CardDifficulty.HARD: 2,
}
_ID_TO_LABEL = {v: k for k, v in _LABEL_TO_ID.items()}


class TsetlinDifficulty:
    """Interpretable TM-based difficulty classifier."""

    def __init__(self, config: DifficultyConfig | None = None) -> None:
        self.config = config or DifficultyConfig()
        # The underlying TM is loaded lazily so importing mneme does not
        # require ``tmu``; type is ``Any`` to avoid leaking the optional
        # dependency into our type signatures.
        self._tm: Any = None
        self._feature_names = CardFeatures.feature_names()

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, cards: list[Card], labels: list[CardDifficulty], epochs: int = 50) -> None:
        """Train the TM on labelled cards.

        ``cards`` and ``labels`` must be the same length. Cards whose
        labels are already attached can be supplied via the convenience
        method :meth:`train_from_labelled_cards`.
        """
        try:
            from tmu.models.classification.vanilla_classifier import TMClassifier
        except ImportError as exc:
            raise RuntimeError(
                "tmu is required for TsetlinDifficulty. pip install tmu>=0.8.3"
            ) from exc

        if len(cards) != len(labels):
            raise ValueError("cards and labels must have the same length")
        if len(cards) == 0:
            raise ValueError("need at least one labelled card to train")

        X = np.array([extract_features(c).to_binary_vector() for c in cards], dtype=np.uint32)
        y = np.array([_LABEL_TO_ID[lbl] for lbl in labels], dtype=np.uint32)

        self._tm = TMClassifier(
            number_of_clauses=self.config.n_clauses,
            T=self.config.T,
            s=self.config.s,
            number_of_state_bits_ta=self.config.state_bits,
            platform="CPU",
        )
        for epoch in range(epochs):
            self._tm.fit(X, y)
            if (epoch + 1) % 10 == 0:
                log.info("TsetlinDifficulty epoch %d", epoch + 1)

    def train_from_labelled_cards(self, cards: list[Card], epochs: int = 50) -> None:
        labels: list[CardDifficulty] = []
        filtered: list[Card] = []
        for c in cards:
            if c.difficulty is None:
                continue
            labels.append(c.difficulty)
            filtered.append(c)
        if not filtered:
            raise ValueError("no cards carry a difficulty label")
        self.train(filtered, labels, epochs=epochs)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def score(self, card: Card) -> Card:
        if self._tm is None:
            raise RuntimeError("TsetlinDifficulty has not been trained or loaded")
        features = extract_features(card)
        x = np.array([features.to_binary_vector()], dtype=np.uint32)
        pred = int(self._tm.predict(x)[0])
        label = _ID_TO_LABEL[pred]
        rationale = self._explain(features, pred)
        return card.model_copy(update={"difficulty": label, "difficulty_rationale": rationale})

    def score_many(self, cards: list[Card]) -> list[Card]:
        return [self.score(c) for c in cards]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def save(self, path: str | Path) -> None:
        if self._tm is None:
            raise RuntimeError("nothing to save; train first")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"tm": self._tm, "config": self.config.model_dump()}, f)

    @classmethod
    def load(cls, path: str | Path) -> TsetlinDifficulty:
        with open(path, "rb") as f:
            blob = pickle.load(f)
        from ..config import DifficultyConfig

        inst = cls(DifficultyConfig.model_validate(blob["config"]))
        inst._tm = blob["tm"]
        return inst

    # ------------------------------------------------------------------
    # Explainability
    # ------------------------------------------------------------------
    def _explain(self, features: CardFeatures, pred: int) -> str:
        """Return a human-readable rationale.

        For v0.1 the rationale lists the binary features that are ``1``
        for this card, paired with the predicted class. A future
        version will walk the TM's clause structure and surface the
        actual firing literals.
        """
        active = [
            name
            for name, val in zip(self._feature_names, features.to_binary_vector(), strict=True)
            if val == 1
        ]
        active_str = ", ".join(active) if active else "no salient features"
        label = _ID_TO_LABEL[pred].value
        return f"TM predicted {label} from literals: {active_str}"
