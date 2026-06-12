"""Disk-backed cache wrapper for any :class:`LLMBackend`.

A re-run on the same source with the same prompt version, model, and
seed should not pay the LLM cost again. This module wraps any backend
with a content-addressed disk cache keyed on the inputs that actually
influence the output.

Cache layout::

    <cache_dir>/llm_cache/
        stats.json                       # rolling hit/miss/last_run counters
        v<PROMPT_VERSION>/
            <sha256[:2]>/<sha256>.json   # one file per cached response

Two-level fanout (the first two hex digits as a subdirectory) keeps
the per-directory file count manageable on filesystems that struggle
with thousands of files in one directory (ext4 dir hash, APFS, NTFS).

The cache key includes everything that can change the response:

- prompt template version (``PROMPT_VERSION``),
- model name,
- seed,
- temperature,
- system + user prompt text,
- the ``json_mode`` flag.

A schema bump only requires changing :data:`CACHE_VERSION`; the next
run silently misses every old entry without breaking.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import logging
import os
import tempfile
import time
from dataclasses import asdict
from pathlib import Path

from .backend import LLMBackend, LLMResponse

log = logging.getLogger(__name__)


# Bump only when the on-disk format changes incompatibly.
CACHE_VERSION = "1"

_STATS_FILENAME = "stats.json"


class CachedLLMBackend:
    """Wrap an :class:`LLMBackend` with a disk cache.

    Parameters
    ----------
    inner:
        The real backend (Ollama, mock, llama.cpp, etc.).
    cache_dir:
        Root directory; the cache lives under ``<cache_dir>/llm_cache/``.
    prompt_version:
        The current :data:`mneme.llm.prompts.PROMPT_VERSION`. Mixed
        into the key so prompt edits invalidate prior entries.
    model:
        Model name, e.g. ``"qwen2.5:7b-instruct"``. Mixed into the key.
    seed:
        Deterministic seed, or ``None`` to disable seeding (in which
        case caching is still safe at temperature 0 but useless above).
    default_temperature:
        Fallback temperature when ``complete()`` is called without one.
    """

    def __init__(
        self,
        inner: LLMBackend,
        *,
        cache_dir: str | Path,
        prompt_version: str,
        model: str,
        seed: int | None,
        default_temperature: float,
    ) -> None:
        self.inner = inner
        self.prompt_version = prompt_version
        self.model = model
        self.seed = seed
        self.default_temperature = default_temperature

        self.root = Path(cache_dir).expanduser() / "llm_cache"
        self.bucket = self.root / f"v{prompt_version}"
        self.bucket.mkdir(parents=True, exist_ok=True)
        self.stats_path = self.root / _STATS_FILENAME

        self._stats = _load_stats(self.stats_path)

    # ------------------------------------------------------------------
    # LLMBackend protocol
    # ------------------------------------------------------------------
    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        effective_temperature = (
            temperature if temperature is not None else self.default_temperature
        )
        key = self._key(
            system=system,
            prompt=prompt,
            temperature=effective_temperature,
            json_mode=json_mode,
        )
        cache_path = self._path_for(key)

        cached = _read(cache_path)
        if cached is not None:
            self._record("hits")
            return LLMResponse(**cached["response"])

        self._record("misses")
        response = self.inner.complete(
            prompt,
            system=system,
            temperature=effective_temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )
        _write(
            cache_path,
            {
                "key": key,
                "prompt_version": self.prompt_version,
                "model": self.model,
                "seed": self.seed,
                "temperature": effective_temperature,
                "json_mode": json_mode,
                "system": system,
                "prompt": prompt,
                "response": asdict(response),
                "cached_at": time.time(),
            },
        )
        return response

    # ------------------------------------------------------------------
    # Introspection / maintenance
    # ------------------------------------------------------------------
    @property
    def stats(self) -> dict:
        """Read-only snapshot of the rolling stats."""
        return dict(self._stats)

    @property
    def hit_rate(self) -> float:
        h = self._stats.get("hits", 0)
        m = self._stats.get("misses", 0)
        total = h + m
        return h / total if total else 0.0

    def entries(self) -> list[Path]:
        """Return every cache file under the current prompt-version bucket."""
        return [p for p in self.bucket.rglob("*.json") if p.is_file()]

    def size_bytes(self) -> int:
        return sum(p.stat().st_size for p in self.entries())

    def clear(self) -> int:
        """Delete every entry under the current prompt-version bucket.

        Returns the number of files removed. The ``stats.json`` file is
        also reset so the next run starts with a clean ratio.
        """
        count = 0
        for path in self.entries():
            try:
                path.unlink()
                count += 1
            except OSError:
                log.warning("could not unlink %s", path)
        # Stats are global across versions, but the user just nuked the
        # current version's bucket, so a counter reset is the polite move.
        self._stats = {"hits": 0, "misses": 0, "cleared_at": time.time()}
        _save_stats(self.stats_path, self._stats)
        return count

    def prune(self, older_than_days: float) -> int:
        """Delete cache entries older than ``older_than_days``.

        Returns the number of files removed.
        """
        cutoff = time.time() - older_than_days * 86400
        count = 0
        for path in self.entries():
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink()
                    count += 1
            except OSError:
                continue
        return count

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _key(self, *, system: str | None, prompt: str, temperature: float, json_mode: bool) -> str:
        canonical = json.dumps(
            {
                "cv": CACHE_VERSION,
                "pv": self.prompt_version,
                "model": self.model,
                "seed": self.seed,
                "temp": round(temperature, 6),
                "json_mode": json_mode,
                "system": system or "",
                "prompt": prompt,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _path_for(self, key: str) -> Path:
        return self.bucket / key[:2] / f"{key}.json"

    def _record(self, kind: str) -> None:
        self._stats[kind] = self._stats.get(kind, 0) + 1
        self._stats["last_run_at"] = time.time()
        _save_stats(self.stats_path, self._stats)


# ---------------------------------------------------------------------------
# Free functions used by the `mneme cache` subcommand
# ---------------------------------------------------------------------------


def discover_cache(cache_dir: str | Path) -> Path:
    """Return the path to the cache root under ``cache_dir``."""
    return Path(cache_dir).expanduser() / "llm_cache"


def cache_summary(cache_dir: str | Path) -> dict:
    """Return a summary suitable for `mneme cache info`."""
    root = discover_cache(cache_dir)
    stats_path = root / _STATS_FILENAME
    stats = _load_stats(stats_path)
    entries = list(root.rglob("*.json")) if root.exists() else []
    entries = [p for p in entries if p.name != _STATS_FILENAME]
    total_size = sum(p.stat().st_size for p in entries)
    buckets = sorted({p.parent.parent.name for p in entries})
    oldest = min((p.stat().st_mtime for p in entries), default=None)
    return {
        "root": str(root),
        "entries": len(entries),
        "size_bytes": total_size,
        "prompt_version_buckets": buckets,
        "oldest_entry_age_seconds": (time.time() - oldest) if oldest else None,
        "hits": stats.get("hits", 0),
        "misses": stats.get("misses", 0),
        "last_run_at": stats.get("last_run_at"),
    }


def clear_cache(cache_dir: str | Path) -> int:
    """Delete every cached entry under ``cache_dir``. Returns the count."""
    root = discover_cache(cache_dir)
    if not root.exists():
        return 0
    removed = 0
    for path in root.rglob("*.json"):
        if path.name == _STATS_FILENAME:
            continue
        try:
            path.unlink()
            removed += 1
        except OSError:
            continue
    # Reset stats and remove empty subdirectories.
    _save_stats(root / _STATS_FILENAME, {"hits": 0, "misses": 0, "cleared_at": time.time()})
    for sub in sorted(root.rglob("*"), key=lambda p: -len(p.parts)):
        if sub.is_dir() and not any(sub.iterdir()):
            sub.rmdir()
    return removed


def prune_cache(cache_dir: str | Path, older_than_days: float) -> int:
    """Drop cache entries older than ``older_than_days``. Returns the count."""
    root = discover_cache(cache_dir)
    if not root.exists():
        return 0
    cutoff = time.time() - older_than_days * 86400
    removed = 0
    for path in root.rglob("*.json"):
        if path.name == _STATS_FILENAME:
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            continue
    return removed


# ---------------------------------------------------------------------------
# Internals: atomic JSON IO
# ---------------------------------------------------------------------------


def _read(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        # Corrupt entry: treat as a miss and overwrite on the way out.
        return None


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".mneme-cache-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def _load_stats(path: Path) -> dict:
    if not path.is_file():
        return {"hits": 0, "misses": 0}
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {"hits": 0, "misses": 0}


def _save_stats(path: Path, stats: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("w", encoding="utf-8") as f:
            json.dump(stats, f)
    except OSError:
        log.debug("could not persist cache stats to %s", path)
