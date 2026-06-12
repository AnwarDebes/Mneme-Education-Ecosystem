"""Portable .apkg exporter.

An .apkg file is a zip archive containing an SQLite database that
Anki imports on a double-click. We write the minimal Anki database
schema needed, register the chosen note template (basic, rich, or
cloze), and zip the result.

Why not depend on ``genanki``? It is a fine library, but at the cost
of an extra runtime dep. The schema we need is small enough to build
in-process with the standard library only.

References for the schema:
- https://github.com/ankitects/anki/blob/main/rslib/src/storage/upgrades/schema11.sql
- https://github.com/kerrickstaley/genanki/blob/master/genanki/__init__.py

The output is verified to import into Anki >= 2.1.50.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import tempfile
import time
import zipfile
from hashlib import sha1
from pathlib import Path

from ..types import Card
from .templates import RICH, NoteTemplate

log = logging.getLogger(__name__)


# Fixed identifiers so the same deck name always maps to the same Anki
# deck id; that way re-running mneme on the same source updates the
# existing deck rather than creating a duplicate.
def _stable_id(name: str, salt: str = "mneme") -> int:
    h = sha1(f"{salt}/{name}".encode()).digest()
    # 63-bit unsigned int (Anki ids are signed 64-bit; keep positive).
    return int.from_bytes(h[:7], "big")


class ApkgExporter:
    """Write a list of :class:`Card` to a portable .apkg file.

    Parameters
    ----------
    deck_name:
        Anki deck name. The Anki id is derived from this; running
        the same name twice updates the existing deck rather than
        creating a duplicate.
    template:
        :class:`NoteTemplate` to use. Defaults to :data:`RICH`, the
        styled four-field template with a Source excerpt and a
        difficulty badge. Pass :data:`BASIC` for the original
        two-field layout, or :data:`CLOZE` for cloze-deletion cards.
    """

    def __init__(self, deck_name: str, template: NoteTemplate | None = None) -> None:
        self.deck_name = deck_name
        self.template = template or RICH
        self.deck_id = _stable_id(deck_name, "mneme-deck")
        # The model id is keyed by template name AND the field list so a
        # future schema change to the template gets a new model id, which
        # avoids field-shape mismatches on re-import.
        self.model_id = _stable_id(
            f"{self.template.name}/{'/'.join(self.template.fields)}",
            "mneme-model",
        )

    def export(self, cards: list[Card], output_path: str | Path) -> Path:
        output_path = Path(output_path).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="mneme-apkg-") as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "collection.anki2"
            self._build_database(db_path, cards)
            # An empty media manifest is mandatory.
            (tmp_path / "media").write_text(json.dumps({}))
            self._zip(output_path, db_path, tmp_path / "media")
        log.info(
            "wrote %d cards to %s using template %r",
            len(cards),
            output_path,
            self.template.name,
        )
        return output_path

    # ------------------------------------------------------------------
    # Anki DB construction
    # ------------------------------------------------------------------
    def _build_database(self, db_path: Path, cards: list[Card]) -> None:
        con = sqlite3.connect(str(db_path))
        try:
            self._create_schema(con)
            self._insert_collection_row(con)
            self._insert_notes_and_cards(con, cards)
            con.commit()
        finally:
            con.close()

    def _create_schema(self, con: sqlite3.Connection) -> None:
        # Minimal Anki schema11 subset. Sufficient for a fresh deck import.
        con.executescript(
            """
            CREATE TABLE col (
                id              integer PRIMARY KEY,
                crt             integer NOT NULL,
                mod             integer NOT NULL,
                scm             integer NOT NULL,
                ver             integer NOT NULL,
                dty             integer NOT NULL,
                usn             integer NOT NULL,
                ls              integer NOT NULL,
                conf            text NOT NULL,
                models          text NOT NULL,
                decks           text NOT NULL,
                dconf           text NOT NULL,
                tags            text NOT NULL
            );

            CREATE TABLE notes (
                id              integer PRIMARY KEY,
                guid            text NOT NULL,
                mid             integer NOT NULL,
                mod             integer NOT NULL,
                usn             integer NOT NULL,
                tags            text NOT NULL,
                flds            text NOT NULL,
                sfld            text NOT NULL,
                csum            integer NOT NULL,
                flags           integer NOT NULL,
                data            text NOT NULL
            );

            CREATE TABLE cards (
                id              integer PRIMARY KEY,
                nid             integer NOT NULL,
                did             integer NOT NULL,
                ord             integer NOT NULL,
                mod             integer NOT NULL,
                usn             integer NOT NULL,
                type            integer NOT NULL,
                queue           integer NOT NULL,
                due             integer NOT NULL,
                ivl             integer NOT NULL,
                factor          integer NOT NULL,
                reps            integer NOT NULL,
                lapses          integer NOT NULL,
                left            integer NOT NULL,
                odue            integer NOT NULL,
                odid            integer NOT NULL,
                flags           integer NOT NULL,
                data            text NOT NULL
            );

            CREATE TABLE revlog (
                id              integer PRIMARY KEY,
                cid             integer NOT NULL,
                usn             integer NOT NULL,
                ease            integer NOT NULL,
                ivl             integer NOT NULL,
                lastIvl         integer NOT NULL,
                factor          integer NOT NULL,
                time            integer NOT NULL,
                type            integer NOT NULL
            );

            CREATE TABLE graves (
                usn             integer NOT NULL,
                oid             integer NOT NULL,
                type            integer NOT NULL
            );
            """
        )

    def _insert_collection_row(self, con: sqlite3.Connection) -> None:
        now = int(time.time())
        deck = {
            str(self.deck_id): {
                "id": self.deck_id,
                "name": self.deck_name,
                "extendRev": 50,
                "usn": 0,
                "collapsed": False,
                "newToday": [0, 0],
                "revToday": [0, 0],
                "lrnToday": [0, 0],
                "timeToday": [0, 0],
                "dyn": 0,
                "extendNew": 10,
                "conf": 1,
                "desc": "",
                "mod": now,
                "browserCollapsed": False,
            }
        }
        # Anki's `req` array describes which fields must be non-empty
        # for each card template to render. For a normal (non-cloze)
        # template the first card just needs the first field
        # populated; cloze templates have their own machinery so we
        # leave req empty for those.
        req = [[0, "any", [0]]] if self.template.type == 0 else []
        model = {
            str(self.model_id): {
                "id": self.model_id,
                "name": self.template.name,
                "type": self.template.type,
                "mod": now,
                "usn": 0,
                "sortf": 0,
                "did": self.deck_id,
                "tmpls": [
                    {
                        "name": t["name"],
                        "ord": i,
                        "qfmt": t["qfmt"],
                        "afmt": t["afmt"],
                        "bqfmt": "",
                        "bafmt": "",
                        "did": None,
                        "bfont": "",
                        "bsize": 0,
                    }
                    for i, t in enumerate(self.template.templates)
                ],
                "flds": [
                    {
                        "name": name,
                        "ord": i,
                        "sticky": False,
                        "rtl": False,
                        "font": "Arial",
                        "size": 20,
                        "media": [],
                    }
                    for i, name in enumerate(self.template.fields)
                ],
                "css": self.template.css,
                "latexPre": "",
                "latexPost": "",
                "req": req,
            }
        }
        con.execute(
            "INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                1,
                now,
                now,
                now,
                11,
                0,
                0,
                0,
                "{}",
                json.dumps(model),
                json.dumps(deck),
                json.dumps({"1": {"id": 1, "name": "Default", "new": {"perDay": 20}, "rev": {"perDay": 200}}}),
                "{}",
            ),
        )

    def _insert_notes_and_cards(self, con: sqlite3.Connection, cards: list[Card]) -> None:
        now = int(time.time())
        nid_base = now * 1000
        for i, card in enumerate(cards):
            note_id = nid_base + i
            fields = self.template.render_fields(card)
            guid = sha1(f"{fields[0]}/{fields[1] if len(fields) > 1 else ''}/{i}".encode()).hexdigest()[:10]
            flds = "\x1f".join(fields)
            sfld = fields[0]  # sort field defaults to the first
            csum = int(sha1(sfld.encode("utf-8")).hexdigest()[:8], 16)
            tags = " ".join(card.tags) if card.tags else ""
            con.execute(
                "INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (note_id, guid, self.model_id, now, -1, f" {tags} ", flds, sfld, csum, 0, ""),
            )
            con.execute(
                "INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    note_id + 1,
                    note_id,
                    self.deck_id,
                    0,
                    now,
                    -1,
                    0,
                    0,
                    i,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    "",
                ),
            )

    def _zip(self, output_path: Path, db_path: Path, media_path: Path) -> None:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(db_path, arcname="collection.anki2")
            z.write(media_path, arcname="media")
