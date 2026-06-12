"""Card-difficulty scoring.

Two backends:

- :class:`HeuristicDifficulty`: rule-of-thumb scorer that ships as the
  default. Works without any extra dependencies.
- :class:`TsetlinDifficulty`: interpretable classifier built on
  the ``tmu`` Tsetlin Machine library. Optional; off by default in
  v0.1 to keep the install minimal. When enabled it produces
  human-readable clauses ("hard because [literals]") that show up in
  the per-card rationale.

Both implement :class:`DifficultyClassifier`.
"""
from .features import CardFeatures, extract_features
from .heuristic import HeuristicDifficulty
from .protocol import DifficultyClassifier
from .selector import build_difficulty_classifier

__all__ = [
    "DifficultyClassifier",
    "HeuristicDifficulty",
    "CardFeatures",
    "extract_features",
    "build_difficulty_classifier",
]
