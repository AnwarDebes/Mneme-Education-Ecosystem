"""Pure-Python TF-IDF fallback embedding backend.

When the user has not installed ``sentence-transformers`` and is not
running Ollama with an embedding model, we still want de-dup to work.
Plain TF-IDF over character n-grams catches the easy cases ("same
question with one word swapped"). It does not match a neural embedding
on paraphrase, but it never refuses to load.
"""
from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


class TFIDFFallback:
    """Lightweight TF-IDF embedding for short questions."""

    def __init__(self, ngram_min: int = 1, ngram_max: int = 2) -> None:
        self.ngram_min = ngram_min
        self.ngram_max = ngram_max
        self._vocab: dict[str, int] | None = None
        self._idf: np.ndarray | None = None

    def embed(self, texts: list[str]) -> np.ndarray:
        # Tokenize.
        token_lists = [self._tokenise(t) for t in texts]
        # Build vocab + DF.
        df: Counter[str] = Counter()
        for tokens in token_lists:
            df.update(set(tokens))
        vocab = {term: i for i, term in enumerate(sorted(df))}
        n_docs = max(len(texts), 1)
        idf = np.zeros(len(vocab), dtype=np.float32)
        for term, idx in vocab.items():
            idf[idx] = math.log((1.0 + n_docs) / (1.0 + df[term])) + 1.0
        # TF.
        mat = np.zeros((len(texts), len(vocab)), dtype=np.float32)
        for i, tokens in enumerate(token_lists):
            counts = Counter(tokens)
            length = max(sum(counts.values()), 1)
            for term, c in counts.items():
                j = vocab[term]
                mat[i, j] = (c / length) * idf[j]
        # Cache vocab + idf so a follow-up embed call (e.g., a test
        # batch) reuses them deterministically if the user wants.
        self._vocab = vocab
        self._idf = idf
        return mat

    def _tokenise(self, text: str) -> list[str]:
        words = [m.group(0).lower() for m in _TOKEN_RE.finditer(text)]
        if self.ngram_min == 1 and self.ngram_max == 1:
            return words
        out: list[str] = []
        for n in range(self.ngram_min, self.ngram_max + 1):
            for i in range(len(words) - n + 1):
                out.append(" ".join(words[i : i + n]))
        return out
