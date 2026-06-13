"""AnkiConnect HTTP client.

AnkiConnect (https://foosoft.net/projects/anki-connect/) is a popular
Anki add-on (id 2055492159) that exposes an HTTP API on
``localhost:8765``. This client wraps the subset of the API we need:

- ``createDeck`` to ensure the target deck exists,
- ``addNotes`` to push our cards in bulk,
- ``modelNames`` to verify the chosen note type exists.

We never modify existing notes; we never delete anything. The
client surfaces failures as :class:`AnkiConnectError` so the
pipeline can decide whether to retry, fall back to .apkg export, or
abort.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from ..config import AnkiConfig
from ..types import Card

log = logging.getLogger(__name__)


class AnkiConnectError(RuntimeError):
    """Raised when AnkiConnect refuses a request or is unreachable."""


class AnkiConnectClient:
    """Thin wrapper around the AnkiConnect HTTP API."""

    def __init__(self, config: AnkiConfig | None = None, timeout_s: float = 30.0) -> None:
        self.config = config or AnkiConfig()
        self.timeout_s = timeout_s
        self._session = requests.Session()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def ping(self) -> bool:
        """Return True iff AnkiConnect is reachable."""
        try:
            self._invoke("version")
            return True
        except AnkiConnectError:
            return False

    def ensure_deck(self, deck_name: str) -> None:
        """Create the deck if it does not exist."""
        self._invoke("createDeck", {"deck": deck_name})

    def list_note_types(self) -> list[str]:
        return list(self._invoke("modelNames"))

    def add_cards(self, cards: list[Card], deck_name: str) -> list[int]:
        """Push ``cards`` into ``deck_name``. Returns AnkiConnect note ids."""
        if not cards:
            return []
        self.ensure_deck(deck_name)
        notes = [self._card_to_note(c, deck_name) for c in cards]
        result = self._invoke("addNotes", {"notes": notes})
        # AnkiConnect returns one id per note; failed notes come back as null.
        ids: list[int] = []
        n_dropped = 0
        for note_id in result:
            if note_id is None:
                n_dropped += 1
                continue
            ids.append(int(note_id))
        if n_dropped:
            log.warning("AnkiConnect dropped %d / %d notes (likely duplicates)", n_dropped, len(notes))
        return ids

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _card_to_note(self, card: Card, deck_name: str) -> dict[str, Any]:
        tags = list(card.tags)
        if self.config.tag_prefix:
            tags.append(self.config.tag_prefix)
            if card.difficulty is not None:
                tags.append(f"{self.config.tag_prefix}::difficulty::{card.difficulty.value}")
        # Anki's built-in "Basic" model only has Front + Back. Any
        # other model the user has registered may have a Source /
        # Difficulty field, so we include them when present and let
        # AnkiConnect silently drop fields the target model does not
        # have (its default behaviour at API v6).
        fields: dict[str, str] = {"Front": card.question, "Back": card.answer}
        if card.source_fact:
            fields["Source"] = card.source_fact
        if card.difficulty is not None:
            rationale = card.difficulty_rationale or ""
            fields["Difficulty"] = (
                f"{card.difficulty.value} - {rationale}" if rationale else card.difficulty.value
            )
        return {
            "deckName": deck_name,
            "modelName": self.config.note_type,
            "fields": fields,
            "options": {"allowDuplicate": False, "duplicateScope": "deck"},
            "tags": tags,
        }

    def _invoke(self, action: str, params: dict[str, Any] | None = None) -> Any:
        payload: dict[str, Any] = {"action": action, "version": 6, "params": params or {}}
        try:
            r = self._session.post(
                self.config.ankiconnect_url, json=payload, timeout=self.timeout_s
            )
            r.raise_for_status()
            data = r.json()
        except (requests.RequestException, ValueError) as exc:
            raise AnkiConnectError(f"AnkiConnect {action!r} failed: {exc}") from exc
        if data.get("error"):
            raise AnkiConnectError(f"AnkiConnect {action!r} returned error: {data['error']}")
        return data.get("result")
