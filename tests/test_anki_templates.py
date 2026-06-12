"""Tests for the Anki note-type templates.

The contract:

- Each template has the right field set.
- The lookup function maps short names to templates and raises on
  unknown names.
- Render produces the expected field values for the typical card.
- Both Basic and Rich templates round-trip a card through the .apkg
  exporter into a valid SQLite file Anki can import.
- The Cloze template emits cloze-flagged notes whose Text field
  carries the ``{{c1::...}}`` markers.
"""
from __future__ import annotations

import json
import sqlite3
import zipfile
from pathlib import Path

import pytest

from mneme.anki.apkg import ApkgExporter
from mneme.anki.templates import BASIC, CLOZE, RICH, template_for_name
from mneme.types import Card, CardDifficulty

# ---------------------------------------------------------------------------
# Template registry
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name, expected",
    [("basic", BASIC), ("rich", RICH), ("cloze", CLOZE), ("BASIC", BASIC), ("Rich", RICH)],
)
def test_template_for_name_known(name, expected) -> None:
    assert template_for_name(name) is expected


def test_template_for_name_unknown_raises() -> None:
    with pytest.raises(ValueError, match="unknown note template"):
        template_for_name("totally-made-up")


# ---------------------------------------------------------------------------
# Field rendering
# ---------------------------------------------------------------------------


def _card() -> Card:
    return Card(
        question="What pigment absorbs light in chloroplasts?",
        answer="Chlorophyll",
        source_fact="Chloroplasts contain chlorophyll, which absorbs sunlight.",
        difficulty=CardDifficulty.MEDIUM,
        difficulty_rationale="contains a named entity",
        tags=["biology"],
    )


def test_basic_renders_two_fields() -> None:
    fields = BASIC.render_fields(_card())
    assert fields == [
        "What pigment absorbs light in chloroplasts?",
        "Chlorophyll",
    ]


def test_rich_renders_all_four_fields_with_difficulty_html() -> None:
    fields = RICH.render_fields(_card())
    assert len(fields) == 4
    assert fields[0] == "What pigment absorbs light in chloroplasts?"
    assert fields[1] == "Chlorophyll"
    assert "Chloroplasts contain chlorophyll" in fields[2]
    assert "difficulty-medium" in fields[3]
    assert "contains a named entity" in fields[3]


def test_rich_handles_missing_optional_fields() -> None:
    card = Card(question="What is X?", answer="A")
    fields = RICH.render_fields(card)
    # Source and Difficulty render as empty strings so Anki's
    # {{#Field}} guards hide the blocks.
    assert fields[2] == ""
    assert fields[3] == ""


def test_cloze_template_carries_question_into_text_field() -> None:
    card = Card(
        question="Mitochondria produce {{c1::ATP}}.",
        answer="ATP",
        source_fact="Mitochondria produce ATP via cellular respiration.",
        difficulty=CardDifficulty.EASY,
        difficulty_rationale="single-word answer",
    )
    fields = CLOZE.render_fields(card)
    assert fields[0] == "Mitochondria produce {{c1::ATP}}."
    assert "Mitochondria produce ATP" in fields[1]
    assert "difficulty-easy" in fields[2]


# ---------------------------------------------------------------------------
# .apkg integration: every template round-trips through SQLite
# ---------------------------------------------------------------------------


def _read_apkg(path: Path) -> dict:
    with zipfile.ZipFile(path) as zf:
        zf.extract("collection.anki2", path.parent)
        zf.extract("media", path.parent)
    db_path = path.parent / "collection.anki2"
    con = sqlite3.connect(str(db_path))
    try:
        col = con.execute("SELECT models, decks FROM col").fetchone()
        models = json.loads(col[0])
        notes = con.execute("SELECT flds, sfld, mid FROM notes").fetchall()
        cards = con.execute("SELECT nid, did, ord FROM cards").fetchall()
    finally:
        con.close()
    return {"models": models, "notes": notes, "cards": cards}


def test_basic_exporter_writes_two_field_notes(tmp_path: Path) -> None:
    apkg = tmp_path / "basic.apkg"
    ApkgExporter("basic-deck", template=BASIC).export([_card()], apkg)
    db = _read_apkg(apkg)
    model = next(iter(db["models"].values()))
    assert [f["name"] for f in model["flds"]] == ["Front", "Back"]
    # The field separator in Anki's flds column is U+001F.
    assert db["notes"][0][0].split("\x1f") == ["What pigment absorbs light in chloroplasts?", "Chlorophyll"]


def test_rich_exporter_writes_four_field_notes(tmp_path: Path) -> None:
    apkg = tmp_path / "rich.apkg"
    ApkgExporter("rich-deck", template=RICH).export([_card()], apkg)
    db = _read_apkg(apkg)
    model = next(iter(db["models"].values()))
    assert [f["name"] for f in model["flds"]] == ["Front", "Back", "Source", "Difficulty"]
    flds = db["notes"][0][0].split("\x1f")
    assert flds[0] == "What pigment absorbs light in chloroplasts?"
    assert flds[1] == "Chlorophyll"
    assert "chlorophyll" in flds[2].lower()
    assert "difficulty-medium" in flds[3]


def test_cloze_exporter_marks_model_as_cloze(tmp_path: Path) -> None:
    apkg = tmp_path / "cloze.apkg"
    card = Card(
        question="Photosynthesis occurs in {{c1::chloroplasts}}.",
        answer="chloroplasts",
        source_fact="Photosynthesis occurs in chloroplasts of plant cells.",
    )
    ApkgExporter("cloze-deck", template=CLOZE).export([card], apkg)
    db = _read_apkg(apkg)
    model = next(iter(db["models"].values()))
    assert model["type"] == 1
    flds = db["notes"][0][0].split("\x1f")
    assert "{{c1::chloroplasts}}" in flds[0]


def test_default_template_is_rich(tmp_path: Path) -> None:
    """Confirm the .apkg exporter defaults to RICH (the new default).

    Backward-compatibility note: existing users get an upgrade in
    output formatting on their next run, not a breakage; the deck id
    is keyed on the deck name, but the model id is keyed on the
    template name + field set, so the new template lands in a fresh
    Anki model that does not conflict with prior runs.
    """
    apkg = tmp_path / "default.apkg"
    ApkgExporter("default-deck").export([_card()], apkg)
    db = _read_apkg(apkg)
    model = next(iter(db["models"].values()))
    assert model["name"] == "mneme-rich"
    assert len(model["flds"]) == 4
