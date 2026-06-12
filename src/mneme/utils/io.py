"""JSONL helpers used by the run-summary writer and the cache layer."""
from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


def write_jsonl(path: str | Path, rows: Iterable[Any]) -> None:
    """Write rows to a JSONL file. Parent directories are created."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(_serialise(row))
            f.write("\n")


def read_jsonl(path: str | Path) -> Iterator[dict]:
    p = Path(path)
    with open(p, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _serialise(obj: Any) -> str:
    if hasattr(obj, "model_dump_json"):
        return obj.model_dump_json()
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), default=str)
    return json.dumps(obj, default=str)
