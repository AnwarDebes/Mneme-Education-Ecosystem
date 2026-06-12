"""Difficulty classifier selector."""
from __future__ import annotations

import logging

from ..config import DifficultyConfig
from .heuristic import HeuristicDifficulty
from .protocol import DifficultyClassifier

log = logging.getLogger(__name__)


def build_difficulty_classifier(config: DifficultyConfig) -> DifficultyClassifier | None:
    """Return the configured classifier, or ``None`` if disabled."""
    if config.backend == "none":
        return None
    if config.backend == "heuristic":
        return HeuristicDifficulty()
    if config.backend == "tsetlin":
        try:
            from .tsetlin import TsetlinDifficulty
        except RuntimeError as exc:
            log.warning("tsetlin backend unavailable (%s); falling back to heuristic", exc)
            return HeuristicDifficulty()
        if config.model_path:
            return TsetlinDifficulty.load(config.model_path)
        # User asked for tsetlin but did not supply a trained model.
        log.warning("tsetlin backend selected but no model_path; falling back to heuristic")
        return HeuristicDifficulty()
    raise ValueError(f"unknown difficulty backend {config.backend!r}")
