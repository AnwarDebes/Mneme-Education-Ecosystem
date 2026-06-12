"""Tests for the .apkg exporter."""
from __future__ import annotations

import sqlite3
import zipfile

from mneme.anki.apkg import ApkgExporter
from mneme.types import Card


def test_apkg_creates_valid_zip(tmp_path):
    cards = [
        Card(question="What is the capital of France?", answer="Paris"),
        Card(question="What is 2 + 2?", answer="4"),
    ]
    out = ApkgExporter("Test Deck").export(cards, tmp_path / "out.apkg")
    assert out.exists()
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        assert "collection.anki2" in names
        assert "media" in names


def test_apkg_database_is_readable_sqlite(tmp_path):
    cards = [
        Card(question="Q1?", answer="A1"),
        Card(question="Q2?", answer="A2"),
    ]
    out = ApkgExporter("Demo").export(cards, tmp_path / "out.apkg")
    with zipfile.ZipFile(out) as z:
        z.extract("collection.anki2", path=tmp_path)
    db = tmp_path / "collection.anki2"
    con = sqlite3.connect(str(db))
    try:
        n_notes = con.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        n_cards = con.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
        n_col = con.execute("SELECT COUNT(*) FROM col").fetchone()[0]
    finally:
        con.close()
    assert n_notes == 2
    assert n_cards == 2
    assert n_col == 1


def test_apkg_handles_empty_card_list(tmp_path):
    out = ApkgExporter("Empty").export([], tmp_path / "empty.apkg")
    assert out.exists()
