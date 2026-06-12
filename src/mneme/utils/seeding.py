"""Reproducible seeding across Python's random, numpy, and PYTHONHASHSEED."""
from __future__ import annotations

import os
import random


def seed_all(seed: int) -> None:
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    try:
        import numpy as np
        np.random.seed(seed)
    except ImportError:
        pass
