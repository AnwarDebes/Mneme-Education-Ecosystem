"""Plug a custom embedding backend into the mneme deduplicator.

Two examples:

1. A hash-based embedding that needs no model download. Useful as a
   smoke test or for environments without network access.
2. A wrapper around the OpenAI embeddings endpoint (off by default;
   uncomment and bring your own key if you actually want to call out
   to a cloud provider).

Run::

    python examples/custom_embedding_backend.py examples/sample.md
"""
from __future__ import annotations

import hashlib
import sys

import numpy as np

from mneme import Config, Pipeline, Source
from mneme.cards.deduplicate import Deduplicator
from mneme.extraction import detect_kind
from mneme.llm.backend import MockBackend

# ---------------------------------------------------------------------------
# Backend: simhash-style embedding (no model, no network).
# ---------------------------------------------------------------------------


class HashEmbedding:
    """Deterministic 64-dim embedding from text hashes.

    The vector for ``text`` is the sign of the sum of per-token
    sha1-derived bit vectors. Two texts with overlapping vocabularies
    end up with similar embeddings; truly different texts diverge.
    Not as good as a real model but the algorithm is one screen long
    and runs in microseconds.
    """

    DIM = 64

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.DIM), dtype=np.float32)
        for i, text in enumerate(texts):
            tokens = [t for t in text.lower().split() if t]
            if not tokens:
                continue
            vec = np.zeros(self.DIM, dtype=np.float32)
            for tok in tokens:
                digest = hashlib.sha1(tok.encode("utf-8")).digest()
                bits = np.unpackbits(np.frombuffer(digest, dtype=np.uint8))[: self.DIM]
                # Map 0/1 to -1/+1 so accumulation makes sense.
                vec += bits.astype(np.float32) * 2 - 1
            out[i] = vec
        return out


# ---------------------------------------------------------------------------
# Optional: OpenAI wrapper. Uncomment to use, BUT note that this is the
# only file in mneme that calls out to a cloud provider. Doing so
# discards the local-first guarantee for the deduplication stage.
# ---------------------------------------------------------------------------


# class OpenAIEmbedding:
#     """Wrap OpenAI's text-embedding-3-small. Requires OPENAI_API_KEY."""
#
#     MODEL = "text-embedding-3-small"
#
#     def __init__(self) -> None:
#         import openai
#         self._client = openai.OpenAI()
#
#     def embed(self, texts: list[str]) -> np.ndarray:
#         resp = self._client.embeddings.create(model=self.MODEL, input=texts)
#         return np.array([d.embedding for d in resp.data], dtype=np.float32)


# ---------------------------------------------------------------------------
# Wire it into the pipeline.
# ---------------------------------------------------------------------------


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 1

    source = Source(kind=detect_kind(sys.argv[1]), path=sys.argv[1])

    config = Config()
    config.anki.use_ankiconnect = False
    config.anki.apkg_export_path = "out.apkg"

    backend = HashEmbedding()

    # You can either:
    #  (a) pass the backend directly to the pipeline (the deduplicator
    #      is built around it), or
    #  (b) pre-build a Deduplicator and let the pipeline call it.
    # Both are equivalent; (a) is the common path.
    pipeline = Pipeline(
        config,
        llm=MockBackend(routes={"Extract up to": "[]", "Write up to": "[]"}),
        embedding_backend=backend,
    )

    # Confirm the deduplicator picked up our backend.
    assert isinstance(pipeline.deduplicator, Deduplicator)
    assert pipeline.deduplicator.backend is backend  # type: ignore[attr-defined]

    summary = pipeline.run(source)
    print({
        "cards_emitted": summary.cards_emitted,
        "embedding_backend": type(backend).__name__,
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
