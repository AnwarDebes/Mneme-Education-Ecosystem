"""Tests for the configuration loader."""
from __future__ import annotations

import pytest

from mneme.config import Config


def test_defaults_are_self_consistent():
    c = Config()
    assert c.llm.model.startswith("qwen") or c.llm.model.startswith("llama")
    assert c.embedding.dedup_threshold > 0.5
    assert c.chunker.target_tokens > 100


def test_to_yaml_round_trip(tmp_path):
    c = Config()
    yaml_text = c.to_yaml()
    p = tmp_path / "cfg.yaml"
    p.write_text(yaml_text)
    c2 = Config.from_yaml(p)
    assert c2.llm.model == c.llm.model
    assert c2.embedding.model == c.embedding.model


def test_log_level_validator():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Config(log_level="GIBBERISH")


def test_from_env(monkeypatch):
    monkeypatch.setenv("MNEME_LLM_MODEL", "qwen2.5:14b")
    monkeypatch.setenv("MNEME_EMBEDDING_DEDUP_THRESHOLD", "0.99")
    c = Config.from_env()
    assert c.llm.model == "qwen2.5:14b"
    assert abs(c.embedding.dedup_threshold - 0.99) < 1e-9
