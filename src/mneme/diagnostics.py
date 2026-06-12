"""Diagnostic helpers backing ``mneme doctor`` and ``mneme models``.

These checks never raise. Every probe returns a :class:`CheckResult`
whose ``ok``, ``detail``, and ``hint`` fields the CLI renders.
Programmatic callers (the FastAPI ``/api/health`` endpoint, the
frontend's "system status" panel) can iterate the same results and
render them in their own UI.

The split between this module and the CLI keeps the orchestration
testable: a unit test calls :func:`run_doctor` with a stub Ollama
URL and asserts on the result list, without spawning a subprocess.
"""
from __future__ import annotations

import importlib
import logging
import socket
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import requests

from .config import Config

log = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# Result types
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class CheckResult:
    """Outcome of a single doctor probe.

    Attributes
    ----------
    name:
        Short human label, e.g. ``"Ollama daemon"``.
    ok:
        True if the probe succeeded.
    detail:
        One-line description of what was observed.
    hint:
        Optional remediation hint shown when ``ok`` is False.
    """

    name: str
    ok: bool
    detail: str
    hint: str | None = None


@dataclass(frozen=True)
class ModelInfo:
    """One entry returned by Ollama's ``/api/tags``."""

    name: str
    size_bytes: int
    modified_at: str | None = None

    @property
    def size_pretty(self) -> str:
        return _humanise_bytes(self.size_bytes)


@dataclass(frozen=True)
class DoctorReport:
    """Aggregated result of all probes."""

    checks: list[CheckResult] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(c.ok for c in self.checks)

    @property
    def summary_line(self) -> str:
        passed = sum(1 for c in self.checks if c.ok)
        total = len(self.checks)
        status = "ok" if self.ok else "issues found"
        return f"{passed}/{total} checks passed ({status})"


# --------------------------------------------------------------------------
# Individual probes
# --------------------------------------------------------------------------


def check_ollama_reachable(base_url: str, timeout_s: float = 3.0) -> CheckResult:
    """Probe the Ollama daemon's ``/api/tags`` endpoint."""
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=timeout_s)
        r.raise_for_status()
        return CheckResult(
            name="Ollama daemon",
            ok=True,
            detail=f"reachable at {base_url}",
        )
    except requests.RequestException as exc:
        return CheckResult(
            name="Ollama daemon",
            ok=False,
            detail=f"unreachable at {base_url} ({exc.__class__.__name__})",
            hint=(
                "Install Ollama (https://ollama.com/download) and start "
                "the daemon, then pull a model (e.g. "
                "`ollama pull qwen2.5:7b-instruct`)."
            ),
        )


def check_ollama_model(base_url: str, model: str, timeout_s: float = 3.0) -> CheckResult:
    """Verify the configured model is pulled on the daemon."""
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=timeout_s)
        r.raise_for_status()
        tags: list[dict[str, Any]] = r.json().get("models", [])
    except requests.RequestException as exc:
        return CheckResult(
            name=f"Ollama model {model!r}",
            ok=False,
            detail=f"could not query tags ({exc.__class__.__name__})",
            hint="Resolve the daemon-unreachable warning first.",
        )

    family = model.split(":", 1)[0]
    matches = [m for m in tags if str(m.get("name", "")).startswith(family)]
    if any(str(m.get("name", "")) == model for m in tags):
        return CheckResult(
            name=f"Ollama model {model!r}",
            ok=True,
            detail="exact tag is pulled",
        )
    if matches:
        names = ", ".join(sorted(str(m["name"]) for m in matches))
        return CheckResult(
            name=f"Ollama model {model!r}",
            ok=False,
            detail=f"exact tag not pulled; have {names}",
            hint=(
                f"Pull the exact tag with `ollama pull {model}`, or set "
                f"`config.llm.model` to one of the tags above."
            ),
        )
    return CheckResult(
        name=f"Ollama model {model!r}",
        ok=False,
        detail="no matching model on the daemon",
        hint=f"Pull it with `ollama pull {model}`.",
    )


def check_ankiconnect(url: str, timeout_s: float = 3.0) -> CheckResult:
    """Probe AnkiConnect by asking for its version."""
    try:
        r = requests.post(
            url,
            json={"action": "version", "version": 6},
            timeout=timeout_s,
        )
        r.raise_for_status()
        payload = r.json()
        if payload.get("error"):
            return CheckResult(
                name="AnkiConnect",
                ok=False,
                detail=f"responded with error: {payload['error']}",
                hint="Open Anki and confirm AnkiConnect add-on 2055492159 is enabled.",
            )
        version = payload.get("result")
        return CheckResult(
            name="AnkiConnect",
            ok=True,
            detail=f"reachable, API version {version}",
        )
    except requests.RequestException as exc:
        return CheckResult(
            name="AnkiConnect",
            ok=False,
            detail=f"unreachable at {url} ({exc.__class__.__name__})",
            hint=(
                "AnkiConnect is optional. Either start Anki with the "
                "add-on (id 2055492159) loaded, or rely on the "
                ".apkg export fallback (no action required)."
            ),
        )


def check_optional_dependency(import_name: str, install_extra: str | None = None) -> CheckResult:
    """Try to import an optional dependency."""
    try:
        importlib.import_module(import_name)
        return CheckResult(
            name=f"optional dep {import_name!r}",
            ok=True,
            detail="importable",
        )
    except ImportError as exc:
        extra = install_extra or import_name
        return CheckResult(
            name=f"optional dep {import_name!r}",
            ok=False,
            detail=f"not installed ({exc.msg})",
            hint=f"`pip install mneme[{extra}]` to enable it.",
        )


def check_cache_writable(path: str) -> CheckResult:
    """Verify the cache directory exists or can be created and written to."""
    from pathlib import Path

    p = Path(path).expanduser()
    try:
        p.mkdir(parents=True, exist_ok=True)
        probe = p / ".mneme_doctor_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return CheckResult(
            name="cache directory",
            ok=True,
            detail=f"writable at {p}",
        )
    except OSError as exc:
        return CheckResult(
            name="cache directory",
            ok=False,
            detail=f"not writable at {p}: {exc}",
            hint=(
                "Set `config.cache_dir` (or the MNEME_CACHE_DIR env var) "
                "to a writable location."
            ),
        )


def check_dns_for_url(url: str) -> CheckResult | None:
    """Confirm the URL's host resolves. Returns ``None`` for local URLs."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if not host or host in {"localhost", "127.0.0.1", "::1"}:
        return None
    try:
        socket.gethostbyname(host)
        return CheckResult(
            name=f"DNS for {host}",
            ok=True,
            detail="resolves",
        )
    except socket.gaierror as exc:
        return CheckResult(
            name=f"DNS for {host}",
            ok=False,
            detail=f"does not resolve ({exc})",
            hint="Check the URL or your network connectivity.",
        )


# --------------------------------------------------------------------------
# Composite runner
# --------------------------------------------------------------------------


def run_doctor(config: Config | None = None) -> DoctorReport:
    """Run every probe and return the aggregated :class:`DoctorReport`."""
    config = config or Config()
    checks: list[CheckResult] = []

    checks.append(check_cache_writable(config.cache_dir))

    if config.llm.backend == "ollama":
        checks.append(check_ollama_reachable(config.llm.base_url))
        checks.append(check_ollama_model(config.llm.base_url, config.llm.model))
        dns = check_dns_for_url(config.llm.base_url)
        if dns is not None:
            checks.append(dns)

    if config.anki.use_ankiconnect:
        checks.append(check_ankiconnect(config.anki.ankiconnect_url))

    checks.append(check_optional_dependency("sentence_transformers", install_extra="embeddings"))
    checks.append(check_optional_dependency("tmu", install_extra="tm"))

    return DoctorReport(checks=checks)


def list_ollama_models(base_url: str, timeout_s: float = 5.0) -> list[ModelInfo]:
    """Return the list of models pulled on the Ollama daemon."""
    r = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=timeout_s)
    r.raise_for_status()
    payload = r.json()
    out: list[ModelInfo] = []
    for entry in payload.get("models", []):
        out.append(
            ModelInfo(
                name=str(entry.get("name", "")),
                size_bytes=int(entry.get("size", 0)),
                modified_at=str(entry.get("modified_at", "")) or None,
            )
        )
    return sorted(out, key=lambda m: m.name)


# --------------------------------------------------------------------------
# Demo source (kept in-process so `mneme demo` works after `pip install`)
# --------------------------------------------------------------------------


DEMO_TITLE = "Photosynthesis (demo)"
DEMO_SOURCE_MARKDOWN = """\
# Photosynthesis

Photosynthesis is the process by which green plants and some other
organisms use sunlight, water, and carbon dioxide to produce glucose
and oxygen.

## Reactions

The light-dependent reactions take place in the thylakoid membrane.
They produce ATP and NADPH.

The Calvin cycle takes place in the stroma of the chloroplast. It
fixes carbon dioxide into a three-carbon sugar called G3P.

## Equation

The net equation is: 6 CO2 + 6 H2O + light -> C6H12O6 + 6 O2.
"""


# --------------------------------------------------------------------------
# Internals
# --------------------------------------------------------------------------


def _humanise_bytes(n: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(n)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024
    return f"{n} B"  # unreachable
