"""Atomic-fact extractor and Q/A card generator.

Both classes share the same shape: instantiate with a config + an
LLMBackend, then call ``extract`` / ``generate`` per chunk / fact.
They are decoupled so the pipeline can run fact extraction in
parallel and card generation later.
"""
from __future__ import annotations

import logging
import os
import re
import sys
from collections.abc import Iterable
from typing import Any

from tqdm import tqdm

from ..config import GeneratorConfig
from ..llm.backend import LLMBackend
from ..llm.parsing import parse_json_payload
from ..llm.prompts import atomic_facts_prompt, cloze_generation_prompt, qa_generation_prompt
from ..types import AtomicFact, Card, Chunk

log = logging.getLogger(__name__)


_LIST_KEYS = ("facts", "cards", "items", "results", "data", "atomic_facts", "flashcards", "qa", "questions")


def _maybe_progress(iterable, *, desc: str, total: int | None = None):
    """Wrap ``iterable`` with a tqdm bar when stderr is a TTY.

    Progress bars in CI logs are noise; this helper makes them appear
    only in interactive terminals. ``MNEME_NO_PROGRESS=1`` silences
    them everywhere for users who want clean stderr.
    """
    if os.environ.get("MNEME_NO_PROGRESS"):
        return iterable
    if not sys.stderr.isatty():
        return iterable
    return tqdm(iterable, desc=desc, total=total, unit="it", leave=False)


def _coerce_to_list(payload: Any) -> list[dict]:
    """Accept three LLM output shapes and return a list of dicts.

    * Bare list of dicts: returned unchanged.
    * Single dict that has one of the known list-valued keys: unwrapped.
    * Single dict that looks like a record itself: wrapped in a list.

    Anything else returns an empty list (and the caller logs).
    """
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in _LIST_KEYS:
            if key in payload and isinstance(payload[key], list):
                return [x for x in payload[key] if isinstance(x, dict)]
        # Looks like a single record. Wrap.
        return [payload]
    return []


class FactExtractor:
    """Extract atomic facts from chunks using the LLM."""

    def __init__(self, backend: LLMBackend, config: GeneratorConfig | None = None) -> None:
        self.backend = backend
        self.config = config or GeneratorConfig()

    def extract(self, chunks: Iterable[Chunk]) -> list[AtomicFact]:
        chunks_list = list(chunks)
        out: list[AtomicFact] = []
        for chunk in _maybe_progress(chunks_list, desc="facts", total=len(chunks_list)):
            facts = self._extract_one(chunk)
            out.extend(facts)
        log.info("extracted %d atomic facts", len(out))
        return out

    def _extract_one(self, chunk: Chunk) -> list[AtomicFact]:
        system, user = atomic_facts_prompt(chunk.text, max_facts=self.config.max_facts_per_chunk)
        # json_mode=False on purpose: several local LLMs (Gemma 3, some
        # Llama 3.x variants) constrained by Ollama's format=json
        # emit a single JSON object even when the prompt asks for an
        # array. The tolerant parser in mneme.llm.parsing handles
        # markdown-fenced and prose-prefixed JSON robustly.
        try:
            resp = self.backend.complete(user, system=system, json_mode=False)
        except Exception as exc:
            log.warning("LLM call failed for chunk %d: %s", chunk.index, exc)
            return []
        try:
            payload = parse_json_payload(resp.text)
        except ValueError as exc:
            log.warning("could not parse facts for chunk %d: %s", chunk.index, exc)
            return []
        entries = _coerce_to_list(payload)
        if not entries:
            log.warning("no usable facts for chunk %d (raw payload type %s)", chunk.index, type(payload).__name__)
            return []
        facts: list[AtomicFact] = []
        for entry in entries:
            fact_text = str(entry.get("fact", "")).strip()
            if not fact_text or len(fact_text) < 3:
                continue
            try:
                facts.append(
                    AtomicFact(
                        fact=fact_text,
                        source_chunk=chunk.index,
                        confidence=float(entry.get("confidence", 0.7)),
                        rationale=str(entry.get("rationale", "")).strip() or None,
                    )
                )
            except ValueError as exc:
                log.debug("dropping malformed fact: %s", exc)
        return facts


class CardGenerator:
    """Turn atomic facts into Q/A flashcards using the LLM."""

    def __init__(self, backend: LLMBackend, config: GeneratorConfig | None = None) -> None:
        self.backend = backend
        self.config = config or GeneratorConfig()

    def generate(self, facts: Iterable[AtomicFact]) -> list[Card]:
        facts_list = list(facts)
        out: list[Card] = []
        for fact in _maybe_progress(facts_list, desc="cards", total=len(facts_list)):
            out.extend(self._generate_one(fact))
        log.info("generated %d cards from atomic facts", len(out))
        return out

    def _generate_one(self, fact: AtomicFact) -> list[Card]:
        if self.config.card_type == "cloze":
            return self._generate_one_cloze(fact)
        return self._generate_one_basic(fact)

    def _generate_one_basic(self, fact: AtomicFact) -> list[Card]:
        system, user = qa_generation_prompt(fact.fact, max_cards=self.config.max_cards_per_fact)
        # See FactExtractor._extract_one for why json_mode is False.
        try:
            resp = self.backend.complete(user, system=system, json_mode=False)
        except Exception as exc:
            log.warning("LLM call failed for fact %r: %s", fact.fact[:60], exc)
            return []
        try:
            payload = parse_json_payload(resp.text)
        except ValueError as exc:
            log.warning("could not parse cards for fact %r: %s", fact.fact[:60], exc)
            return []
        entries = _coerce_to_list(payload)
        if not entries:
            log.warning("no usable cards for fact %r (raw type %s)", fact.fact[:60], type(payload).__name__)
            return []
        cards: list[Card] = []
        for entry in entries:
            q = str(entry.get("question", "")).strip()
            a = str(entry.get("answer", "")).strip()
            if not q or not a:
                continue
            tags = entry.get("tags", [])
            if not isinstance(tags, list):
                tags = []
            try:
                cards.append(
                    Card(
                        question=q,
                        answer=a,
                        source_fact=fact.fact,
                        source_chunk=fact.source_chunk,
                        tags=[str(t) for t in tags if str(t).strip()],
                    )
                )
            except ValueError as exc:
                log.debug("dropping malformed card: %s", exc)
        return cards

    def _generate_one_cloze(self, fact: AtomicFact) -> list[Card]:
        """Cloze-deletion generation.

        The LLM returns a JSON array of ``{"cloze": "...{{c1::term}}..."}``
        entries. We carry the cloze sentence in ``Card.question`` so the
        apkg exporter's CLOZE template can place it in the Anki Text
        field; ``Card.answer`` becomes a comma-separated list of the
        deleted terms (useful in the Anki browser and as a fallback for
        AnkiConnect models that lack a Text field).
        """
        system, user = cloze_generation_prompt(
            fact.fact, max_cards=self.config.max_cards_per_fact
        )
        try:
            resp = self.backend.complete(user, system=system, json_mode=False)
        except Exception as exc:
            log.warning("cloze LLM call failed for fact %r: %s", fact.fact[:60], exc)
            return []
        try:
            payload = parse_json_payload(resp.text)
        except ValueError as exc:
            log.warning("could not parse cloze for fact %r: %s", fact.fact[:60], exc)
            return []
        entries = _coerce_to_list(payload)
        if not entries:
            log.warning(
                "no usable cloze cards for fact %r (raw type %s)",
                fact.fact[:60],
                type(payload).__name__,
            )
            return []
        cards: list[Card] = []
        for entry in entries:
            cloze = str(entry.get("cloze") or entry.get("text") or "").strip()
            if not cloze or "{{c" not in cloze:
                # Anki refuses cloze cards that contain no cloze marker.
                continue
            deleted = _extract_cloze_terms(cloze)
            answer = ", ".join(deleted) if deleted else "(cloze)"
            tags = entry.get("tags", [])
            if not isinstance(tags, list):
                tags = []
            try:
                cards.append(
                    Card(
                        question=cloze,
                        answer=answer,
                        source_fact=fact.fact,
                        source_chunk=fact.source_chunk,
                        tags=[str(t) for t in tags if str(t).strip()],
                    )
                )
            except ValueError as exc:
                log.debug("dropping malformed cloze card: %s", exc)
        return cards


_CLOZE_TERM_RE = re.compile(r"\{\{c\d+::([^{}]+?)(?:::[^{}]+)?\}\}")


def _extract_cloze_terms(text: str) -> list[str]:
    """Return the visible terms inside ``{{c1::term}}`` markers."""
    return [m.group(1).strip() for m in _CLOZE_TERM_RE.finditer(text)]
