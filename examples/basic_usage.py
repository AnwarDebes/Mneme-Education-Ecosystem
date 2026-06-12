"""Smallest end-to-end Python demo.

Requires a running Ollama daemon with a model pulled (defaults to
``qwen2.5:7b-instruct``). Anki is optional; if AnkiConnect is
unreachable the script falls back to writing a .apkg file in the
current directory.

Usage::

    python examples/basic_usage.py examples/sample.md

The companion smoke test in tests/test_pipeline.py runs the same
pipeline with a MockBackend so the codepath is exercised on every
test run, even without Ollama installed.
"""
from __future__ import annotations

import argparse
import json
import sys

from mneme import Config, Pipeline, Source
from mneme.extraction import detect_kind
from mneme.utils.logging import configure_logging


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="PDF, EPUB, MD, TXT, HTML, or URL")
    parser.add_argument("--deck-name", help="Anki deck name")
    parser.add_argument("--apkg", help="write portable deck here", default=None)
    parser.add_argument("--no-ankiconnect", action="store_true")
    args = parser.parse_args()

    configure_logging("INFO")
    config = Config()
    if args.deck_name:
        config.anki.deck_name = args.deck_name
    if args.no_ankiconnect:
        config.anki.use_ankiconnect = False
    if args.apkg:
        config.anki.apkg_export_path = args.apkg

    source = Source(kind=detect_kind(args.input), path=args.input)
    summary = Pipeline(config).run(source)
    print(json.dumps(
        {
            "cards_emitted": summary.cards_emitted,
            "deck_name": summary.deck_name,
            "apkg_path": summary.apkg_path,
            "anki_note_ids": len(summary.anki_note_ids),
        },
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
