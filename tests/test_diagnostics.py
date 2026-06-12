"""Unit tests for the diagnostics module.

These probes the doctor uses must:

- Never raise (they always return a CheckResult).
- Carry an actionable hint when ``ok=False``.
- Be inspectable as plain dataclasses so downstream UIs (the FastAPI
  server, the frontend's settings panel) can render them.
"""
from __future__ import annotations

import requests

from mneme.config import Config
from mneme.diagnostics import (
    DEMO_SOURCE_MARKDOWN,
    CheckResult,
    DoctorReport,
    ModelInfo,
    check_ankiconnect,
    check_cache_writable,
    check_dns_for_url,
    check_ollama_model,
    check_ollama_reachable,
    check_optional_dependency,
    list_ollama_models,
    run_doctor,
)

# ---------------------------------------------------------------------------
# CheckResult dataclass
# ---------------------------------------------------------------------------


def test_check_result_is_immutable_and_serialisable() -> None:
    r = CheckResult(name="x", ok=True, detail="d")
    assert r.name == "x"
    try:
        r.name = "y"  # type: ignore[misc]
    except Exception:
        pass  # frozen
    else:
        raise AssertionError("CheckResult must be frozen")


# ---------------------------------------------------------------------------
# Network-free probes (use a port nothing should be listening on)
# ---------------------------------------------------------------------------

_UNREACHABLE = "http://127.0.0.1:1"


def test_check_ollama_reachable_reports_failure_with_hint() -> None:
    r = check_ollama_reachable(_UNREACHABLE, timeout_s=0.5)
    assert not r.ok
    assert r.hint is not None
    assert "ollama" in r.hint.lower()


def test_check_ollama_model_handles_unreachable() -> None:
    r = check_ollama_model(_UNREACHABLE, "qwen2.5:7b-instruct", timeout_s=0.5)
    assert not r.ok
    assert "qwen2.5" in r.name


def test_check_ankiconnect_handles_unreachable() -> None:
    r = check_ankiconnect(_UNREACHABLE, timeout_s=0.5)
    assert not r.ok
    assert "AnkiConnect" in r.name


# ---------------------------------------------------------------------------
# Filesystem probes
# ---------------------------------------------------------------------------


def test_check_cache_writable_succeeds_on_tmp_path(tmp_path) -> None:
    r = check_cache_writable(str(tmp_path / "fresh"))
    assert r.ok
    assert "writable" in r.detail


def test_check_cache_writable_reports_failure_on_readonly_target(tmp_path, monkeypatch) -> None:
    # Point at a path that cannot be created (file already exists as a
    # regular file, so mkdir fails).
    blocker = tmp_path / "blocker"
    blocker.write_text("nope")
    r = check_cache_writable(str(blocker / "subdir"))
    assert not r.ok
    assert r.hint  # actionable


# ---------------------------------------------------------------------------
# Optional dependency probe
# ---------------------------------------------------------------------------


def test_check_optional_dependency_returns_ok_for_known_import() -> None:
    r = check_optional_dependency("json")  # stdlib; always importable
    assert r.ok


def test_check_optional_dependency_returns_failure_for_missing_dep() -> None:
    r = check_optional_dependency("definitely_not_a_real_package_xyzzy")
    assert not r.ok
    assert "pip install" in (r.hint or "")


# ---------------------------------------------------------------------------
# DNS probe
# ---------------------------------------------------------------------------


def test_check_dns_skips_localhost() -> None:
    assert check_dns_for_url("http://localhost:11434") is None
    assert check_dns_for_url("http://127.0.0.1:11434") is None


# ---------------------------------------------------------------------------
# Composite runner
# ---------------------------------------------------------------------------


def test_run_doctor_completes_without_network(monkeypatch) -> None:
    """run_doctor must finish under any condition (no Ollama, no Anki)."""
    # Force every HTTP probe to fail fast.
    def _fail_request(*args, **kwargs):
        raise requests.ConnectionError("simulated offline")

    monkeypatch.setattr(requests, "get", _fail_request)
    monkeypatch.setattr(requests, "post", _fail_request)

    config = Config()
    report = run_doctor(config)
    assert isinstance(report, DoctorReport)
    assert report.checks, "doctor produced no checks"
    assert "checks passed" in report.summary_line


def test_run_doctor_skips_ollama_checks_when_backend_is_mock() -> None:
    config = Config()
    config.llm.backend = "mock"
    config.anki.use_ankiconnect = False
    report = run_doctor(config)
    names = [c.name for c in report.checks]
    assert not any("Ollama" in n for n in names)
    assert not any("AnkiConnect" in n for n in names)


# ---------------------------------------------------------------------------
# Model listing (network-free failure path)
# ---------------------------------------------------------------------------


def test_list_ollama_models_raises_on_unreachable(monkeypatch) -> None:
    def _fail(*args, **kwargs):
        raise requests.ConnectionError("nope")

    monkeypatch.setattr(requests, "get", _fail)
    try:
        list_ollama_models(_UNREACHABLE, timeout_s=0.1)
    except requests.RequestException:
        pass
    else:
        raise AssertionError("list_ollama_models should propagate request errors")


def test_model_info_pretty_size() -> None:
    assert ModelInfo("x", 0).size_pretty == "0 B"
    assert "MB" in ModelInfo("x", 5 * 1024 * 1024).size_pretty
    assert "GB" in ModelInfo("x", 5 * 1024 * 1024 * 1024).size_pretty


# ---------------------------------------------------------------------------
# Demo content
# ---------------------------------------------------------------------------


def test_demo_source_is_non_empty_and_well_formed() -> None:
    # The demo source is bundled in-process so `mneme demo` works after
    # a `pip install` without the examples/ directory.
    assert DEMO_SOURCE_MARKDOWN.startswith("# Photosynthesis")
    # At least two paragraphs.
    assert DEMO_SOURCE_MARKDOWN.count("\n\n") >= 3
