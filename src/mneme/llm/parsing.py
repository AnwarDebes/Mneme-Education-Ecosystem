"""Tolerant JSON parsing for LLM outputs.

Local 7B-class LLMs sometimes wrap JSON in fenced code blocks, prepend
chatty prefixes, or close arrays a token early. The helpers below
extract the JSON payload from the surrounding noise and fall back to
a best-effort repair before raising.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_ARRAY_RE = re.compile(r"\[\s*\{.*?\}\s*\]", re.DOTALL)
_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_json_payload(text: str) -> Any:
    """Parse the first JSON value found in ``text``.

    Tries in order:

    1. The raw string after stripping leading / trailing whitespace.
    2. The content of the first fenced ``json`` code block.
    3. The first balanced ``[...]`` or ``{...}`` substring.
    4. :func:`repair_json` as a last resort.

    Raises :class:`json.JSONDecodeError` if all four fail.
    """
    candidates = _extract_candidates(text)
    last_exc: json.JSONDecodeError | None = None
    for cand in candidates:
        try:
            return json.loads(cand)
        except json.JSONDecodeError as exc:
            last_exc = exc
            continue
    # Final attempt: repair the most JSON-shaped candidate.
    if candidates:
        repaired = repair_json(candidates[0])
        try:
            return json.loads(repaired)
        except json.JSONDecodeError as exc:
            last_exc = exc
    if last_exc is None:
        raise json.JSONDecodeError("no JSON payload found", text, 0)
    raise last_exc


def parse_jsonl_payload(text: str) -> list[Any]:
    """Parse newline-delimited JSON. Empty / non-JSON lines are skipped."""
    out: list[Any] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            log.debug("skipping non-JSON line in JSONL payload: %r", line[:80])
            continue
    return out


def repair_json(text: str) -> str:
    """Best-effort repair of common LLM JSON glitches.

    The goal is not to be a full JSON5 parser; it is to fix the two or
    three glitches a local 7B model produces on the way to a useful
    output: trailing commas before ``]`` or ``}``, missing closing
    bracket / brace, smart quotes.
    """
    s = text
    # Smart quotes -> straight quotes.
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"')
    # Trailing commas before ] or }.
    s = re.sub(r",(\s*[\]\}])", r"\1", s)
    # Balance brackets (cheap heuristic; do not use on hostile input).
    s = _balance(s, "[", "]")
    s = _balance(s, "{", "}")
    return s


def _balance(s: str, open_ch: str, close_ch: str) -> str:
    opens = s.count(open_ch)
    closes = s.count(close_ch)
    if opens > closes:
        return s + close_ch * (opens - closes)
    return s


def _extract_candidates(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    cands: list[str] = [text]
    for m in _FENCE_RE.finditer(text):
        cands.append(m.group(1).strip())
    for m in _ARRAY_RE.finditer(text):
        cands.append(m.group(0).strip())
    for m in _OBJECT_RE.finditer(text):
        cands.append(m.group(0).strip())
    # Deduplicate while preserving order.
    seen: set[str] = set()
    out: list[str] = []
    for c in cands:
        if c and c not in seen:
            out.append(c)
            seen.add(c)
    return out
