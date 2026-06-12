"""LLM backend protocol and a deterministic mock implementation."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class LLMError(RuntimeError):
    """Raised when the LLM call cannot be satisfied."""


@dataclass(frozen=True)
class LLMResponse:
    text: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    model: str | None = None


class LLMBackend(Protocol):
    """Single-method protocol every backend must satisfy.

    The pipeline never reads the backend's class; it just calls
    ``complete(prompt, ...)``. Pass any object that exposes this
    method to :class:`mneme.Pipeline` and the pipeline accepts it.
    """

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        ...


class MockBackend:
    """Deterministic LLM stand-in for tests.

    Two modes are supported:

    1. **Queue mode** (default): pass a list of canned responses to
       ``responses``. Each ``complete()`` call pops the head of the
       queue. When empty, ``"[]"`` is returned so JSON-mode callers
       always parse cleanly.

    2. **Routed mode**: pass ``routes`` as a dict ``{substring: response}``.
       The mock returns the response whose substring is found in the
       prompt or system message. The first match wins; if nothing
       matches the queue is consulted (or ``"[]"`` returned).

    Routed mode lets the pipeline call fact extraction and card
    generation in any order without test setup needing to know the
    call sequence. The ``calls`` list records every prompt for
    assertions.
    """

    def __init__(
        self,
        responses: list[str] | None = None,
        routes: dict[str, str] | None = None,
    ) -> None:
        self.responses = list(responses or [])
        self.routes = dict(routes or {})
        self.calls: list[dict] = []

    def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        self.calls.append(
            {
                "prompt": prompt,
                "system": system,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "json_mode": json_mode,
            }
        )
        # Routed mode: pick the first route whose key appears in prompt
        # or system. Substring match preserves the order of insertion.
        haystack = (system or "") + "\n" + prompt
        for needle, response in self.routes.items():
            if needle in haystack:
                return LLMResponse(text=response, model="mock")
        text = self.responses.pop(0) if self.responses else "[]"
        return LLMResponse(text=text, model="mock")
