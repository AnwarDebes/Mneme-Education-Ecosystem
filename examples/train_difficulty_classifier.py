"""Train the optional Tsetlin-Machine difficulty classifier.

Reads a JSONL file where each line is a flashcard plus a ``difficulty``
label (``easy`` / ``medium`` / ``hard``), trains a small Tsetlin
Machine on the binarised card features, and saves the model to disk.

The trained model is then usable by the main pipeline::

    mneme build textbook.pdf --config myconfig.yaml

where ``myconfig.yaml`` contains::

    difficulty:
      backend: tsetlin
      model_path: ./mneme_difficulty.tm

A sample labelled-cards JSONL file lives at ``examples/labelled_cards.jsonl``.

Requires the optional ``tmu`` dependency: ``pip install tmu>=0.8.3``.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from mneme.config import DifficultyConfig
from mneme.difficulty.tsetlin import TsetlinDifficulty
from mneme.types import Card, CardDifficulty
from mneme.utils.logging import configure_logging


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="JSONL file of labelled cards")
    parser.add_argument("--out", default="./mneme_difficulty.tm", help="path to write the trained model")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--clauses", type=int, default=50)
    parser.add_argument("--T", type=int, default=15)
    parser.add_argument("--s", type=float, default=3.9)
    args = parser.parse_args()

    configure_logging("INFO")

    cards: list[Card] = []
    labels: list[CardDifficulty] = []
    for row in Path(args.input).read_text().splitlines():
        if not row.strip():
            continue
        d = json.loads(row)
        labels.append(CardDifficulty(d["difficulty"]))
        cards.append(Card(question=d["question"], answer=d["answer"]))

    if not cards:
        print("no cards in input file", file=sys.stderr)
        return 1

    cfg = DifficultyConfig(
        backend="tsetlin",
        n_clauses=args.clauses,
        T=args.T,
        s=args.s,
    )
    model = TsetlinDifficulty(cfg)
    model.train(cards, labels, epochs=args.epochs)
    model.save(args.out)
    print(f"trained on {len(cards)} cards; saved model to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
