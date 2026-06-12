"""Tests for tolerant JSON parsing."""
from __future__ import annotations

import json

import pytest

from mneme.llm.parsing import parse_json_payload, parse_jsonl_payload, repair_json


def test_plain_json_array():
    assert parse_json_payload('[{"a": 1}]') == [{"a": 1}]


def test_fenced_json_block():
    text = "Here you go:\n```json\n[{\"a\": 1}]\n```\nthanks"
    assert parse_json_payload(text) == [{"a": 1}]


def test_embedded_array():
    text = "leading prose [{\"a\": 1}, {\"b\": 2}] trailing"
    assert parse_json_payload(text) == [{"a": 1}, {"b": 2}]


def test_trailing_comma_repair():
    text = '[{"a": 1,},]'
    parsed = parse_json_payload(text)
    assert parsed == [{"a": 1}]


def test_smart_quote_repair():
    text = '[{“a”: 1}]'
    parsed = parse_json_payload(text)
    assert parsed == [{"a": 1}]


def test_jsonl_skip_non_json_lines():
    text = "noise\n{\"a\": 1}\nmore noise\n{\"b\": 2}\n"
    assert parse_jsonl_payload(text) == [{"a": 1}, {"b": 2}]


def test_repair_balances_brackets():
    text = '[{"a": 1}'
    repaired = repair_json(text)
    assert json.loads(repaired) == [{"a": 1}]


def test_raises_on_garbage():
    import json

    with pytest.raises(json.JSONDecodeError):
        parse_json_payload("not json at all, no brackets")
