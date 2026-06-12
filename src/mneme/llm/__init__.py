"""LLM backends.

The pipeline talks to LLMs through the :class:`LLMBackend` protocol so
tests can swap in :class:`MockBackend` without a running Ollama
daemon. Production runs use :class:`OllamaBackend`.
"""
from .backend import LLMBackend, LLMError, MockBackend
from .ollama_backend import OllamaBackend
from .parsing import parse_json_payload, parse_jsonl_payload, repair_json

__all__ = [
    "LLMBackend",
    "LLMError",
    "MockBackend",
    "OllamaBackend",
    "parse_json_payload",
    "parse_jsonl_payload",
    "repair_json",
]
