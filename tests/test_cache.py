"""Tests for the disk-backed LLM response cache.

The contract the cache must satisfy:

- Identical inputs (prompt + system + temperature + model + seed +
  prompt_version + json_mode) hit on the second call.
- Changing any one input misses.
- Cached responses round-trip through :class:`LLMResponse` with all
  metadata preserved.
- ``clear()`` and ``prune()`` are accurate.
- Stats are persisted so ``cache_summary`` produces stable output
  across processes.
"""
from __future__ import annotations

from pathlib import Path

from mneme.llm.backend import LLMResponse, MockBackend
from mneme.llm.cache import (
    CachedLLMBackend,
    cache_summary,
    clear_cache,
    prune_cache,
)


def _backend(tmp_path: Path, *, model: str = "test-model", seed: int | None = 42) -> CachedLLMBackend:
    return CachedLLMBackend(
        MockBackend(responses=['{"foo": 1}']),
        cache_dir=tmp_path,
        prompt_version="1",
        model=model,
        seed=seed,
        default_temperature=0.2,
    )


# ---------------------------------------------------------------------------
# Cache hits / misses
# ---------------------------------------------------------------------------


def test_repeated_call_hits_the_cache(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"foo": 1}', '{"foo": 2}'])

    first = backend.complete("hello", system="sys")
    second = backend.complete("hello", system="sys")

    # Second call must serve the same text from the cache.
    assert first.text == second.text == '{"foo": 1}'
    assert backend.stats["hits"] == 1
    assert backend.stats["misses"] == 1
    assert backend.hit_rate == 0.5


def test_different_prompt_misses(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"a": 1}', '{"b": 2}'])

    a = backend.complete("hello")
    b = backend.complete("world")

    assert a.text != b.text
    assert backend.stats["misses"] == 2
    assert backend.stats["hits"] == 0


def test_different_temperature_misses(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}', '{"x": 2}'])

    backend.complete("hello", temperature=0.2)
    backend.complete("hello", temperature=0.5)
    assert backend.stats["misses"] == 2


def test_different_seed_misses(tmp_path: Path) -> None:
    a = _backend(tmp_path, seed=42)
    a.inner = MockBackend(responses=['{"x": 1}'])
    a.complete("hello")
    a_entries = a.entries()

    b = _backend(tmp_path, seed=99)
    b.inner = MockBackend(responses=['{"x": 2}'])
    b.complete("hello")
    b_entries = b.entries()

    # Two distinct cache files, same prompt, different seeds.
    assert {p.name for p in a_entries} != {p.name for p in b_entries}


def test_json_mode_flag_changes_key(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}', '{"x": 2}'])

    backend.complete("same", json_mode=False)
    backend.complete("same", json_mode=True)
    assert backend.stats["misses"] == 2


# ---------------------------------------------------------------------------
# Response round-trip
# ---------------------------------------------------------------------------


def test_cached_response_preserves_metadata(tmp_path: Path) -> None:
    class _MetadataMock:
        def complete(self, prompt, *, system=None, temperature=None, max_tokens=None, json_mode=False):
            return LLMResponse(
                text="{}",
                prompt_tokens=42,
                completion_tokens=7,
                model="gemma3:test",
            )

    backend = CachedLLMBackend(
        _MetadataMock(),
        cache_dir=tmp_path,
        prompt_version="1",
        model="gemma3:test",
        seed=None,
        default_temperature=0.0,
    )

    r1 = backend.complete("hello")
    r2 = backend.complete("hello")
    assert r1.text == r2.text
    assert r1.prompt_tokens == r2.prompt_tokens == 42
    assert r1.completion_tokens == r2.completion_tokens == 7
    assert r1.model == r2.model == "gemma3:test"


# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------


def test_clear_drops_all_entries(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}'] * 5)
    for i in range(3):
        backend.complete(f"prompt-{i}")
    assert len(backend.entries()) == 3

    removed = backend.clear()
    assert removed == 3
    assert backend.entries() == []
    assert backend.stats["hits"] == 0
    assert backend.stats["misses"] == 0


def test_prune_keeps_recent_entries(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}'] * 3)
    backend.complete("recent")
    paths = backend.entries()

    # Backdate one entry to a year ago.
    import os
    import time

    old = paths[0]
    one_year_ago = time.time() - 366 * 86400
    os.utime(old, (one_year_ago, one_year_ago))

    removed = backend.prune(older_than_days=30)
    assert removed == 1
    assert old not in backend.entries()


# ---------------------------------------------------------------------------
# Free-function helpers used by the CLI
# ---------------------------------------------------------------------------


def test_cache_summary_reads_stats_after_run(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}'])
    backend.complete("hello")
    backend.complete("hello")  # hit

    summary = cache_summary(tmp_path)
    assert summary["entries"] == 1
    assert summary["hits"] == 1
    assert summary["misses"] == 1
    assert summary["prompt_version_buckets"] == ["v1"]
    assert summary["size_bytes"] > 0
    assert summary["last_run_at"] is not None


def test_clear_cache_free_function_idempotent(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}'])
    backend.complete("hello")
    assert clear_cache(tmp_path) >= 1
    assert clear_cache(tmp_path) == 0  # nothing left to remove


def test_prune_cache_free_function(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}'])
    backend.complete("hello")
    # Default cutoff is "older than 0 days", which is everything; ensure
    # the cutoff math is correct.
    removed = prune_cache(tmp_path, older_than_days=-1)
    assert removed == 1


# ---------------------------------------------------------------------------
# Corruption tolerance
# ---------------------------------------------------------------------------


def test_corrupt_cache_entry_is_treated_as_a_miss(tmp_path: Path) -> None:
    backend = _backend(tmp_path)
    backend.inner = MockBackend(responses=['{"x": 1}', '{"x": 2}'])

    backend.complete("hello")
    cache_file = next(iter(backend.entries()))
    # Overwrite with garbage; next call should miss and refresh.
    cache_file.write_text("not json at all")

    second = backend.complete("hello")
    assert second.text == '{"x": 2}'  # came from the inner backend
    assert backend.stats["misses"] == 2  # the corrupt entry counted as a miss
