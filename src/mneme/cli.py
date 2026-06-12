"""Command-line interface.

Usage examples::

    mneme build textbook.pdf --apkg cards.apkg
    mneme build https://example.com/article --deck-name "EU AI Act"
    mneme build notes.md --no-ankiconnect --apkg out.apkg
    mneme config print
    mneme config schema > mneme-schema.json
    mneme doctor                       # check Ollama / AnkiConnect / deps
    mneme models                       # list models on the Ollama daemon
    mneme demo                         # end-to-end run with a mock LLM
    mneme version

The CLI is intentionally argparse-based: zero extra dependencies and
trivial to embed in shell scripts.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import tempfile
from pathlib import Path

from . import __version__
from .config import Config
from .extraction.loader import detect_kind
from .pipeline import Pipeline
from .types import Source
from .utils.logging import configure_logging
from .utils.seeding import seed_all

log = logging.getLogger("mneme")


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    configure_logging(level=args.log_level or "INFO")

    if args.command == "version":
        print(f"mneme {__version__}")
        return 0
    if args.command == "config":
        return _cmd_config(args)
    if args.command == "build":
        return _cmd_build(args)
    if args.command == "doctor":
        return _cmd_doctor(args)
    if args.command == "models":
        return _cmd_models(args)
    if args.command == "demo":
        return _cmd_demo(args)
    if args.command == "cache":
        return _cmd_cache(args)
    parser.print_help()
    return 1


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------


def _cmd_build(args: argparse.Namespace) -> int:
    config = _load_config(args)
    if args.deck_name:
        config.anki.deck_name = args.deck_name
    if args.no_ankiconnect:
        config.anki.use_ankiconnect = False
    if args.apkg:
        config.anki.apkg_export_path = args.apkg
    if args.model:
        config.llm.model = args.model
    if args.base_url:
        config.llm.base_url = args.base_url
    if args.seed is not None:
        config.llm.seed = args.seed
        seed_all(args.seed)
    if args.no_cache:
        config.llm.cache_enabled = False
    if args.note_type:
        config.generator.card_type = args.note_type
        # When the user asks for cloze cards we also switch the .apkg
        # template so the on-disk output renders cloze deletions.
        config.anki.note_template = (
            "cloze" if args.note_type == "cloze" else config.anki.note_template
        )

    kind = detect_kind(args.input)
    source = Source(kind=kind, path=args.input, title=args.title)

    if args.dry_run:
        # Force the lightweight TF-IDF embedding backend so the dry-run
        # does not pay the sentence-transformers import cost (which is
        # noticeable: ~6-10 seconds on first import). The dry-run never
        # calls the embedding stage; the choice does not affect the
        # printed estimate.
        config.embedding.backend = "tfidf-fallback"
    pipeline = Pipeline(config)
    if args.dry_run:
        estimate = pipeline.estimate(source)
        print(json.dumps(estimate, indent=2))
        return 0
    summary = pipeline.run(source)

    # Default summary path: next to the .apkg if one was written,
    # otherwise next to the input source file. Falls back to cwd if
    # neither is on a writable path.
    default_summary = None
    if summary.apkg_path:
        default_summary = Path(summary.apkg_path).with_suffix(".summary.json")
    elif args.input and not args.input.startswith(("http://", "https://")):
        default_summary = Path(args.input).with_suffix(".summary.json")
    summary_path = args.summary or default_summary or Path.cwd() / "mneme_run.json"
    Path(summary_path).write_text(summary.model_dump_json(indent=2))
    log.info("wrote run summary to %s", summary_path)
    print(json.dumps(
        {
            "cards_emitted": summary.cards_emitted,
            "deck_name": summary.deck_name,
            "apkg_path": summary.apkg_path,
            "anki_note_ids": len(summary.anki_note_ids),
            "summary_path": str(summary_path),
        },
        indent=2,
    ))
    return 0


def _cmd_config(args: argparse.Namespace) -> int:
    if args.action == "print":
        config = _load_config(args)
        print(config.to_yaml())
        return 0
    if args.action == "schema":
        print(json.dumps(Config.model_json_schema(), indent=2))
        return 0
    print(f"unknown config action {args.action!r}", file=sys.stderr)
    return 1


def _cmd_doctor(args: argparse.Namespace) -> int:
    """Run diagnostic probes and print a human report."""
    from .diagnostics import run_doctor

    config = _load_config(args)
    report = run_doctor(config)
    use_color = sys.stdout.isatty()
    green = "\x1b[32m" if use_color else ""
    red = "\x1b[31m" if use_color else ""
    dim = "\x1b[2m" if use_color else ""
    reset = "\x1b[0m" if use_color else ""
    for check in report.checks:
        glyph = f"{green}OK{reset}" if check.ok else f"{red}FAIL{reset}"
        print(f"  [{glyph}] {check.name}: {check.detail}")
        if check.hint and not check.ok:
            print(f"        {dim}hint:{reset} {check.hint}")
    print()
    print(f"  {report.summary_line}")
    return 0 if report.ok else 1


def _cmd_models(args: argparse.Namespace) -> int:
    """List models available on the configured Ollama daemon."""
    from .diagnostics import list_ollama_models

    config = _load_config(args)
    if getattr(args, "base_url", None):
        config.llm.base_url = args.base_url
    try:
        models = list_ollama_models(config.llm.base_url)
    except Exception as exc:
        print(
            f"could not reach Ollama at {config.llm.base_url}: {exc}",
            file=sys.stderr,
        )
        print(
            "hint: install Ollama from https://ollama.com/download and "
            "start the daemon, then re-run this command.",
            file=sys.stderr,
        )
        return 1
    if not models:
        print(
            f"no models pulled on Ollama at {config.llm.base_url}.",
            file=sys.stderr,
        )
        print(
            f"hint: pull one with `ollama pull {config.llm.model}`.",
            file=sys.stderr,
        )
        return 1
    name_w = max(len(m.name) for m in models)
    size_w = max(len(m.size_pretty) for m in models)
    print(f"  {'NAME'.ljust(name_w)}   {'SIZE'.rjust(size_w)}   MODIFIED")
    for m in models:
        modified = m.modified_at or ""
        print(f"  {m.name.ljust(name_w)}   {m.size_pretty.rjust(size_w)}   {modified}")
    return 0


def _cmd_demo(args: argparse.Namespace) -> int:
    """Run the full pipeline end-to-end with a deterministic mock LLM.

    The point of ``mneme demo`` is twofold:

    1. A fresh install can verify that the pipeline wiring is correct
       without depending on Ollama, network, or a downloaded embedding
       model. Everything runs against a :class:`MockBackend`.
    2. A new user can inspect what mneme produces (an .apkg plus a
       RunSummary JSON) before committing to the real workflow.
    """
    from .diagnostics import DEMO_SOURCE_MARKDOWN, DEMO_TITLE
    from .llm.backend import MockBackend
    from .types import SourceKind

    out_dir = Path(args.out_dir).expanduser().resolve() if args.out_dir else Path(
        tempfile.mkdtemp(prefix="mneme-demo-")
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    source_path = out_dir / "photosynthesis.md"
    source_path.write_text(DEMO_SOURCE_MARKDOWN, encoding="utf-8")
    apkg_path = out_dir / "photosynthesis.apkg"
    summary_path = out_dir / "photosynthesis.summary.json"

    config = Config()
    config.anki.use_ankiconnect = False
    config.anki.apkg_export_path = str(apkg_path)
    config.embedding.backend = "tfidf-fallback"  # avoid downloading a model

    routes = {
        "Extract up to": json.dumps(
            [
                {
                    "fact": "Photosynthesis converts sunlight, water, and carbon dioxide into glucose and oxygen.",
                    "rationale": "Standard biological definition.",
                    "confidence": 0.95,
                },
                {
                    "fact": "The Calvin cycle fixes carbon dioxide into glyceraldehyde-3-phosphate.",
                    "rationale": "Specific biochemical pathway.",
                    "confidence": 0.9,
                },
            ]
        ),
        "Write up to": json.dumps(
            [
                {
                    "question": "What does photosynthesis convert sunlight, water, and carbon dioxide into?",
                    "answer": "Glucose and oxygen.",
                    "tags": ["biology", "demo"],
                }
            ]
        ),
    }
    pipeline = Pipeline(config, llm=MockBackend(routes=routes))
    source = Source(
        kind=SourceKind.MARKDOWN,
        path=str(source_path),
        title=DEMO_TITLE,
    )
    summary = pipeline.run(source)
    summary_path.write_text(summary.model_dump_json(indent=2))

    print(
        json.dumps(
            {
                "cards_emitted": summary.cards_emitted,
                "deck_name": summary.deck_name,
                "apkg_path": str(apkg_path) if apkg_path.exists() else None,
                "summary_path": str(summary_path),
                "out_dir": str(out_dir),
            },
            indent=2,
        )
    )
    return 0


def _load_config(args: argparse.Namespace) -> Config:
    if getattr(args, "config", None):
        return Config.from_yaml(args.config)
    return Config()


def _cmd_cache(args: argparse.Namespace) -> int:
    """Inspect and manage the LLM response cache."""
    from .llm.cache import cache_summary, clear_cache, prune_cache

    config = _load_config(args)
    cache_dir = config.cache_dir

    if args.action == "info":
        summary = cache_summary(cache_dir)
        size_mb = summary["size_bytes"] / (1024 * 1024)
        age_days = (
            summary["oldest_entry_age_seconds"] / 86400
            if summary["oldest_entry_age_seconds"]
            else None
        )
        total = summary["hits"] + summary["misses"]
        hit_rate = (summary["hits"] / total) if total else 0.0
        print(f"  root:           {summary['root']}")
        print(f"  entries:        {summary['entries']}")
        print(f"  size:           {size_mb:.1f} MB")
        print(f"  prompt buckets: {', '.join(summary['prompt_version_buckets']) or '-'}")
        if age_days is not None:
            print(f"  oldest entry:   {age_days:.1f} days old")
        print(f"  hits / misses:  {summary['hits']} / {summary['misses']}  ({hit_rate:.0%} hit rate)")
        return 0

    if args.action == "clear":
        removed = clear_cache(cache_dir)
        print(f"  removed {removed} cache entries under {cache_dir}/llm_cache")
        return 0

    if args.action == "prune":
        days = args.older_than_days
        if days is None or days <= 0:
            print("--older-than DAYS is required and must be > 0", file=sys.stderr)
            return 1
        removed = prune_cache(cache_dir, days)
        print(f"  removed {removed} cache entries older than {days} days")
        return 0

    print(f"unknown cache action {args.action!r}", file=sys.stderr)
    return 1


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


_BUILD_EPILOG = """\
examples:
  mneme build textbook.pdf
      build a deck and push to a running Anki via AnkiConnect.

  mneme build textbook.pdf --apkg out.apkg --no-ankiconnect
      build a portable .apkg without touching Anki.

  mneme build https://example.com/article --deck-name "EU AI Act"
      build from a URL with an explicit deck name.

  mneme build notes.md --model qwen2.5:14b --seed 7
      override the model and the deterministic seed.
"""


_CONFIG_EPILOG = """\
examples:
  mneme config print
      print the default configuration as YAML.

  mneme config print --config my.yaml
      print my.yaml merged with the defaults.

  mneme config schema > mneme-schema.json
      dump the JSON-schema for editor integration.
"""


_DEMO_EPILOG = """\
examples:
  mneme demo
      run end-to-end into a fresh temp directory; print the paths.

  mneme demo --out-dir ./demo-run
      same, but write the .apkg and summary to ./demo-run.

This command does NOT need Ollama, AnkiConnect, or network; it uses a
deterministic MockBackend so you can verify the install in seconds.
"""


_DOCTOR_EPILOG = """\
examples:
  mneme doctor
      run every probe and print a coloured pass/fail report.

  mneme doctor --config my.yaml
      probe against the model + URLs declared in my.yaml.

Exits 0 if every probe passed, 1 otherwise. Suitable for CI use.
"""


_MODELS_EPILOG = """\
examples:
  mneme models
      list every model pulled on the configured Ollama daemon.

  mneme models --base-url http://gpu-box:11434
      query a remote Ollama daemon.

Exits 1 if the daemon is unreachable or has no models pulled.
"""


_CACHE_EPILOG = """\
examples:
  mneme cache info
      print the cache root, entry count, size, and hit rate.

  mneme cache clear
      delete every cache entry and reset the stats.

  mneme cache prune --older-than 30
      delete cache entries that have not been touched in 30 days.

The cache lives under `config.cache_dir/llm_cache` (default
~/.cache/mneme/llm_cache). Disable it for a single run with
`mneme build ... --no-cache`.
"""


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mneme",
        description="Local-first AI flashcard generator: PDF / EPUB / MD / URL -> Anki deck.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Run `mneme <subcommand> --help` for per-command examples and flags."
        ),
    )
    parser.add_argument("--log-level", default=None)
    sub = parser.add_subparsers(dest="command")

    build = sub.add_parser(
        "build",
        help="build a deck from a source",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_BUILD_EPILOG,
    )
    build.add_argument("input", help="path to PDF / EPUB / MD / TXT / HTML, or a URL")
    build.add_argument("--out", "--apkg", dest="apkg", help="path to write the .apkg file")
    build.add_argument("--deck-name", help="Anki deck name (default: filename stem)")
    build.add_argument("--title", help="title for the source (default: filename stem)")
    build.add_argument(
        "--no-ankiconnect",
        action="store_true",
        help="do not push to a running Anki; export .apkg only",
    )
    build.add_argument("--config", help="path to a YAML config file")
    build.add_argument("--model", help="override LLM model name (e.g., qwen2.5:14b)")
    build.add_argument("--base-url", help="override Ollama base URL")
    build.add_argument("--seed", type=int, help="deterministic seed (default: 42)")
    build.add_argument("--summary", help="path to write the JSON run summary")
    build.add_argument(
        "--no-cache",
        action="store_true",
        help="disable the LLM response cache for this run (re-call the LLM)",
    )
    build.add_argument(
        "--note-type",
        choices=["basic", "cloze"],
        default=None,
        help="card style: 'basic' (Q/A) or 'cloze' (sentence with deletions)",
    )
    build.add_argument(
        "--dry-run",
        action="store_true",
        help="load, chunk, and print a cost estimate; do NOT call the LLM",
    )

    cfg = sub.add_parser(
        "config",
        help="inspect default config",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_CONFIG_EPILOG,
    )
    cfg.add_argument("action", choices=["print", "schema"])
    cfg.add_argument("--config", help="optional config file to load before printing")

    doctor = sub.add_parser(
        "doctor",
        help="diagnose Ollama / AnkiConnect / optional deps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_DOCTOR_EPILOG,
    )
    doctor.add_argument("--config", help="optional config file (default: built-in)")

    models = sub.add_parser(
        "models",
        help="list models pulled on the Ollama daemon",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_MODELS_EPILOG,
    )
    models.add_argument("--config", help="optional config file (default: built-in)")
    models.add_argument("--base-url", help="override Ollama base URL")

    demo = sub.add_parser(
        "demo",
        help="run an end-to-end demo with a mock LLM (no Ollama needed)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_DEMO_EPILOG,
    )
    demo.add_argument(
        "--out-dir",
        help="write the .apkg and summary here (default: a fresh temp dir)",
    )

    cache = sub.add_parser(
        "cache",
        help="inspect or manage the LLM response cache",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_CACHE_EPILOG,
    )
    cache.add_argument("action", choices=["info", "clear", "prune"])
    cache.add_argument("--config", help="optional config file (default: built-in)")
    cache.add_argument(
        "--older-than",
        dest="older_than_days",
        type=float,
        default=None,
        help="for `prune`: drop entries older than this many days",
    )

    sub.add_parser("version", help="print the mneme version")
    return parser


if __name__ == "__main__":
    raise SystemExit(main())
