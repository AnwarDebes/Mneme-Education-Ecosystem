"""End-to-end tests for the ``mneme cache`` subcommand.

The subcommand wraps the helpers in :mod:`mneme.llm.cache` so the
test focuses on the CLI surface: argument parsing, exit codes, and
the human-readable output the user actually reads.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from mneme.cli import main
from mneme.llm.backend import MockBackend
from mneme.llm.cache import CachedLLMBackend


def _populate_cache(cache_dir: Path) -> None:
    backend = CachedLLMBackend(
        MockBackend(responses=['{"x": 1}', '{"y": 2}']),
        cache_dir=cache_dir,
        prompt_version="1",
        model="test-model",
        seed=42,
        default_temperature=0.2,
    )
    backend.complete("hello")
    backend.complete("world")
    backend.complete("hello")  # hit


def _config_yaml(tmp_path: Path, cache_dir: Path) -> Path:
    cfg = tmp_path / "mneme.yaml"
    cfg.write_text(f"cache_dir: {cache_dir}\n")
    return cfg


# ---------------------------------------------------------------------------
# info
# ---------------------------------------------------------------------------


def test_cache_info_on_empty_cache(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    rc = main(["cache", "info", "--config", str(_config_yaml(tmp_path, tmp_path / "cache"))])
    out = capsys.readouterr().out
    assert rc == 0
    assert "entries:        0" in out
    assert "0% hit rate" in out


def test_cache_info_after_populating(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    cache_dir = tmp_path / "cache"
    _populate_cache(cache_dir)

    rc = main(["cache", "info", "--config", str(_config_yaml(tmp_path, cache_dir))])
    out = capsys.readouterr().out
    assert rc == 0
    assert "entries:        2" in out
    # 2 misses + 1 hit -> 33% (truncated by the f-string :.0% rule)
    assert "33%" in out


# ---------------------------------------------------------------------------
# clear
# ---------------------------------------------------------------------------


def test_cache_clear_removes_entries(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    cache_dir = tmp_path / "cache"
    _populate_cache(cache_dir)

    rc = main(["cache", "clear", "--config", str(_config_yaml(tmp_path, cache_dir))])
    out = capsys.readouterr().out
    assert rc == 0
    assert "removed 2 cache entries" in out

    # Second clear: nothing left.
    rc = main(["cache", "clear", "--config", str(_config_yaml(tmp_path, cache_dir))])
    out = capsys.readouterr().out
    assert "removed 0 cache entries" in out


# ---------------------------------------------------------------------------
# prune
# ---------------------------------------------------------------------------


def test_cache_prune_requires_older_than(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    rc = main(["cache", "prune", "--config", str(_config_yaml(tmp_path, tmp_path / "cache"))])
    err = capsys.readouterr().err
    assert rc == 1
    assert "--older-than" in err


def test_cache_prune_drops_old_entries(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    import os
    import time

    cache_dir = tmp_path / "cache"
    _populate_cache(cache_dir)

    # Backdate every entry to a year ago.
    for path in cache_dir.rglob("*.json"):
        if path.name == "stats.json":
            continue
        old = time.time() - 366 * 86400
        os.utime(path, (old, old))

    rc = main(
        ["cache", "prune", "--older-than", "30", "--config", str(_config_yaml(tmp_path, cache_dir))]
    )
    out = capsys.readouterr().out
    assert rc == 0
    # The CLI accepts a float (so the user can write `--older-than 0.5`),
    # which is why the rendered count carries a trailing `.0` for ints.
    assert "removed 2 cache entries older than 30" in out


# ---------------------------------------------------------------------------
# Build path: --no-cache, --note-type, --dry-run are recognised by argparse
# ---------------------------------------------------------------------------


def test_build_parser_accepts_new_flags() -> None:
    """The build subcommand must accept the new flags introduced in
    this round without SystemExit-ing on parse.
    """
    from mneme.cli import _build_parser

    parser = _build_parser()
    ns = parser.parse_args(
        [
            "build",
            "missing.md",
            "--no-cache",
            "--note-type",
            "cloze",
            "--dry-run",
        ]
    )
    assert ns.no_cache is True
    assert ns.note_type == "cloze"
    assert ns.dry_run is True


def test_dry_run_emits_estimate_json(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """`mneme build --dry-run` must print a cost estimate and exit 0
    without calling the LLM."""
    import json as _json

    source = tmp_path / "src.md"
    source.write_text(
        "# Sample\n\nPhotosynthesis is a process that converts sunlight into glucose.\n"
        "It takes place in chloroplasts.\n"
    )
    rc = main(["build", str(source), "--dry-run"])
    assert rc == 0
    payload = _json.loads(capsys.readouterr().out)
    assert payload["chunks"] >= 1
    assert payload["max_atomic_facts"] >= payload["chunks"]
    assert payload["estimated_llm_calls_upper_bound"] > 0
    assert payload["estimated_minutes_at_3s_per_call"] > 0
