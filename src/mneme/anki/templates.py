"""Anki note-type templates used by the .apkg exporter and AnkiConnect.

Each :class:`NoteTemplate` is a self-contained Anki note type: field
list, card templates, and CSS. The exporter writes the template's
JSON into the ``col.models`` column; AnkiConnect pushes notes with
the same field shape.

Three templates ship:

- ``BASIC``: two fields (Front / Back), single card. The original
  mneme output, kept for backward compatibility.
- ``RICH``: four fields (Front / Back / Source / Difficulty), single
  card with a styled, light/dark-mode-aware layout that shows the
  source excerpt below the answer. The default in v0.1.x onward.
- ``CLOZE``: a single Text field with ``{{c1::...}}`` markers. Anki's
  built-in cloze deletion machinery handles rendering.

Adding a new template is one entry in this file plus a one-line
update to :func:`template_for_name`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..types import Card

# Anki's note-type code: 0 = Basic, 1 = Cloze.
_TYPE_BASIC = 0
_TYPE_CLOZE = 1


@dataclass(frozen=True)
class NoteTemplate:
    """A complete Anki note type definition.

    Attributes
    ----------
    name:
        Stable identifier; used as the model name in Anki and as the
        salt for the model id, so the same name always maps to the
        same model id.
    type:
        Anki note-type code (0 basic, 1 cloze).
    fields:
        Ordered list of field names.
    templates:
        List of card templates. Each is a dict with ``name``,
        ``qfmt``, and ``afmt`` keys (Anki's standard shape).
    css:
        Per-model CSS string (applies to every card of this type).
    """

    name: str
    type: int
    fields: list[str]
    templates: list[dict]
    css: str
    extra_req: list = field(default_factory=list)

    def render_fields(self, card: Card) -> list[str]:
        """Convert a :class:`Card` into this template's field values.

        Returns one string per entry in ``self.fields``. Templates
        with extra fields (Source, Difficulty, ...) read them from
        the card if present; missing fields render as the empty
        string so Anki simply hides them in templates wrapped in
        ``{{#FieldName}}...{{/FieldName}}``.
        """
        if self.type == _TYPE_CLOZE:
            return _render_cloze_fields(self, card)
        out: list[str] = []
        for name in self.fields:
            out.append(_render_field(name, card))
        return out


# --------------------------------------------------------------------------
# CSS (one block per template; kept inline so the .apkg is self-contained)
# --------------------------------------------------------------------------


_BASIC_CSS = (
    ".card { font-family: arial; font-size: 20px; "
    "text-align: center; color: black; background-color: white; }"
)


_RICH_CSS = """\
.card {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 22px;
    line-height: 1.55;
    text-align: left;
    color: #1f2937;
    background-color: #ffffff;
    padding: 16px 24px;
    max-width: 720px;
    margin: 0 auto;
}
.nightMode .card { color: #e5e7eb; background-color: #111827; }

.question { font-weight: 500; }

.answer {
    margin-top: 1.25em;
    padding-top: 1.25em;
    border-top: 1px solid #d1d5db;
}
.nightMode .answer { border-top-color: #374151; }

.source {
    margin-top: 1.5em;
    font-size: 0.78em;
    color: #6b7280;
    border-left: 3px solid #d1d5db;
    padding: 0.25em 0 0.25em 0.85em;
    font-style: italic;
    background-color: #f9fafb;
}
.nightMode .source {
    color: #9ca3af;
    border-left-color: #4b5563;
    background-color: #1f2937;
}

.difficulty {
    margin-top: 1em;
    font-size: 0.72em;
    color: #6b7280;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.nightMode .difficulty { color: #9ca3af; }

.difficulty-label {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    margin-right: 0.5em;
}
.difficulty-easy   { background: #dcfce7; color: #166534; }
.difficulty-medium { background: #fef3c7; color: #92400e; }
.difficulty-hard   { background: #fee2e2; color: #991b1b; }
.nightMode .difficulty-easy   { background: #14532d; color: #bbf7d0; }
.nightMode .difficulty-medium { background: #78350f; color: #fde68a; }
.nightMode .difficulty-hard   { background: #7f1d1d; color: #fecaca; }
"""


_CLOZE_CSS = _RICH_CSS  # cloze cards use the same look and feel


# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------


BASIC = NoteTemplate(
    name="mneme-basic",
    type=_TYPE_BASIC,
    fields=["Front", "Back"],
    templates=[
        {
            "name": "Card 1",
            "qfmt": "{{Front}}",
            "afmt": "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
        }
    ],
    css=_BASIC_CSS,
)


RICH = NoteTemplate(
    name="mneme-rich",
    type=_TYPE_BASIC,
    fields=["Front", "Back", "Source", "Difficulty"],
    templates=[
        {
            "name": "Card 1",
            "qfmt": '<div class="question">{{Front}}</div>',
            "afmt": (
                '<div class="question">{{Front}}</div>'
                '\n<hr id="answer">\n'
                '<div class="answer">{{Back}}</div>'
                "\n{{#Source}}"
                '<div class="source"><strong>Source:</strong> {{Source}}</div>'
                "{{/Source}}"
                "\n{{#Difficulty}}"
                '<div class="difficulty">{{Difficulty}}</div>'
                "{{/Difficulty}}"
            ),
        }
    ],
    css=_RICH_CSS,
)


CLOZE = NoteTemplate(
    name="mneme-cloze",
    type=_TYPE_CLOZE,
    fields=["Text", "Source", "Difficulty"],
    templates=[
        {
            "name": "Cloze",
            "qfmt": '<div class="question">{{cloze:Text}}</div>',
            "afmt": (
                '<div class="answer">{{cloze:Text}}</div>'
                "\n{{#Source}}"
                '<div class="source"><strong>Source:</strong> {{Source}}</div>'
                "{{/Source}}"
                "\n{{#Difficulty}}"
                '<div class="difficulty">{{Difficulty}}</div>'
                "{{/Difficulty}}"
            ),
        }
    ],
    css=_CLOZE_CSS,
)


# --------------------------------------------------------------------------
# Lookup
# --------------------------------------------------------------------------


_BY_NAME = {
    "basic": BASIC,
    "rich": RICH,
    "cloze": CLOZE,
}


def template_for_name(name: str) -> NoteTemplate:
    """Look up a template by its short name.

    Accepts ``"basic"``, ``"rich"``, or ``"cloze"`` (case-insensitive).
    Raises :class:`ValueError` for any other value so config typos
    surface immediately.
    """
    key = name.strip().lower()
    if key not in _BY_NAME:
        valid = ", ".join(sorted(_BY_NAME))
        raise ValueError(f"unknown note template {name!r}; valid choices are: {valid}")
    return _BY_NAME[key]


# --------------------------------------------------------------------------
# Card -> field rendering
# --------------------------------------------------------------------------


def _render_field(name: str, card: Card) -> str:
    if name == "Front":
        return card.question
    if name == "Back":
        return card.answer
    if name == "Source":
        # Show the originating atomic fact. Empty string -> Anki hides
        # the surrounding {{#Source}}...{{/Source}} block.
        return card.source_fact or ""
    if name == "Difficulty":
        if card.difficulty is None:
            return ""
        label_class = f"difficulty-{card.difficulty.value}"
        rationale = card.difficulty_rationale or ""
        rendered = (
            f'<span class="difficulty-label {label_class}">{card.difficulty.value}</span>'
        )
        if rationale:
            rendered += f"<span>{rationale}</span>"
        return rendered
    # Unknown field name: empty string keeps the .apkg importable even
    # if the user added a template with extra fields by hand.
    return ""


def _render_cloze_fields(template: NoteTemplate, card: Card) -> list[str]:
    """For a CLOZE template the question column holds the cloze text."""
    out: list[str] = []
    for name in template.fields:
        if name == "Text":
            # The CardGenerator places the cloze-formatted string in
            # ``card.question``; the model name is stable but the
            # surface (which field the cloze lives in) is a template
            # decision.
            out.append(card.question)
        elif name == "Source":
            out.append(card.source_fact or "")
        elif name == "Difficulty":
            if card.difficulty is None:
                out.append("")
            else:
                label_class = f"difficulty-{card.difficulty.value}"
                rationale = card.difficulty_rationale or ""
                rendered = (
                    f'<span class="difficulty-label {label_class}">{card.difficulty.value}</span>'
                )
                if rationale:
                    rendered += f"<span>{rationale}</span>"
                out.append(rendered)
        else:
            out.append("")
    return out
