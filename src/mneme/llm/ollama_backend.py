"""Ollama HTTP backend.

Talks to a running Ollama daemon via its REST API
(default: ``http://localhost:11434``). Uses ``requests`` so the
package has no hard dependency on the optional ``ollama`` Python SDK.

The backend honours seeds and temperature exactly as the Ollama
``/api/generate`` endpoint documents them, so two runs with the same
seed produce the same output token-for-token.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import requests

from ..config import LLMConfig
from .backend import LLMError, LLMResponse

log = logging.getLogger(__name__)


class OllamaBackend:
    """LLM backend that calls a local Ollama daemon over HTTP."""

    def __init__(self, config: LLMConfig) -> None:
        self.config = config
        self._session = requests.Session()

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        body = self._build_body(
            prompt=prompt,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )

        last_exc: Exception | None = None
        for attempt in range(self.config.max_retries + 1):
            try:
                resp = self._session.post(
                    f"{self.config.base_url.rstrip('/')}/api/generate",
                    json=body,
                    timeout=self.config.request_timeout_s,
                )
                resp.raise_for_status()
                data = resp.json()
                return LLMResponse(
                    text=data.get("response", ""),
                    prompt_tokens=data.get("prompt_eval_count"),
                    completion_tokens=data.get("eval_count"),
                    model=data.get("model", self.config.model),
                )
            except (requests.RequestException, ValueError) as exc:
                last_exc = exc
                wait = min(2 ** attempt, 30)
                log.warning(
                    "Ollama call failed (attempt %d/%d): %s; retrying in %ds",
                    attempt + 1,
                    self.config.max_retries + 1,
                    exc,
                    wait,
                )
                if attempt < self.config.max_retries:
                    time.sleep(wait)
        raise LLMError(f"Ollama call failed after {self.config.max_retries + 1} attempts") from last_exc

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _build_body(
        self,
        *,
        prompt: str,
        system: str | None,
        temperature: float | None,
        max_tokens: int | None,
        json_mode: bool,
    ) -> dict[str, Any]:
        options: dict[str, Any] = {
            "temperature": temperature if temperature is not None else self.config.temperature,
            "top_p": self.config.top_p,
            "num_ctx": self.config.num_ctx,
        }
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        if self.config.seed is not None:
            options["seed"] = self.config.seed
        body: dict[str, Any] = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": False,
            "options": options,
        }
        if system is not None:
            body["system"] = system
        if json_mode:
            body["format"] = "json"
        return body

    def health_check(self) -> bool:
        """Return True iff the Ollama daemon is reachable and the model is available."""
        try:
            r = self._session.get(
                f"{self.config.base_url.rstrip('/')}/api/tags",
                timeout=min(self.config.request_timeout_s, 5.0),
            )
            r.raise_for_status()
            tags = r.json().get("models", [])
            return any(m.get("name", "").startswith(self.config.model.split(":")[0]) for m in tags)
        except (requests.RequestException, ValueError):
            return False
