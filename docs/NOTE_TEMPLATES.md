# Anki note templates

mneme ships three Anki note templates. The default is `rich`. The
choice affects both the `.apkg` exporter and, when matching models
exist in your Anki collection, the AnkiConnect push.

## Choosing a template

Set it in YAML:

```yaml
anki:
  note_template: rich   # one of: basic, rich, cloze
```

Or on the CLI (cloze only; basic / rich are picked via the YAML
`note_template` field):

```bash
mneme build chapter.pdf --note-type cloze
```

## The three templates

### `basic`

Two fields (Front / Back), one card template. The original mneme
output. Useful when you want to stay close to Anki's built-in Basic
note type and do not need source attribution on the card back.

```
+----------------------+
| What is ATP?         |
|----------------------|
| Adenosine triphos... |
+----------------------+
```

### `rich` (default)

Four fields (Front / Back / Source / Difficulty), one card template
with a styled layout, a quoted source excerpt, and a coloured
difficulty badge. Light / dark mode aware. The default for v0.1.x
onward.

```
+--------------------------------------+
| What is ATP?                         |
|--------------------------------------|
| Adenosine triphosphate               |
|                                      |
| "Source: Mitochondria produce ATP   |
|  via cellular respiration."          |
|                                      |
| EASY  single-word answer             |
+--------------------------------------+
```

### `cloze`

A Text field with `{{c1::...}}` markers plus Source and Difficulty.
Anki renders one card per numbered cloze marker; the studier sees
the sentence with one marker hidden and must recall it.

```
+--------------------------------------+
| Mitochondria produce [...] via       |
| cellular respiration.                |
+--------------------------------------+
```

To produce cloze cards you also need to ask the LLM for cloze
format. That is what `--note-type cloze` does (or
`generator.card_type: cloze` in YAML).

## When to use which

| Template | Best for |
|---|---|
| `basic` | Maximum compatibility with non-mneme tooling; minimal Anki model surface. |
| `rich` | Daily driver. Source attribution on the back is the single biggest quality-of-life upgrade because the studier can verify the card without leaving Anki. |
| `cloze` | Definitional facts, terminology, dates. Cloze cards are the most efficient format for "remember this specific token in context". |

## Backward compatibility

The model id is derived from `template_name/joined_field_list` so
changing templates registers a new Anki model rather than
overwriting your existing notes. Re-importing an `.apkg` written
with a different template lands cards in a new model under the same
deck name. You can move them between models from Anki's browser
("Change Note Type") if you want to consolidate.

## Custom templates

The template definitions live in `src/mneme/anki/templates.py` as
`NoteTemplate` dataclasses. Adding a new one is:

1. Define a `NoteTemplate` instance at module level.
2. Register it in the `_BY_NAME` dict at the bottom of the file.
3. (Optional) Update `_render_field` if your template has fields
   the existing renderers do not know about.

The .apkg exporter picks it up immediately; AnkiConnect will see the
new field names as soon as the matching model exists in Anki.
