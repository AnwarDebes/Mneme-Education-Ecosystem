# Troubleshooting

`mneme doctor` is the first thing to run when something is off. It
checks reachability for Ollama and AnkiConnect, the presence of
optional dependencies, and the cache directory. Below are the
specific failure modes the doctor cannot fully diagnose on its own.

## Pipeline runs but emits zero cards

The most common cause: the LLM returned no usable JSON for every
chunk. Inspect the run log; you will see lines like

```
mneme.cards.generator: no usable facts for chunk 3 (raw payload type str)
```

Three things to try, in order:

1. **Switch model.** If you are on a sub-4B model, even excellent
   prompts will not coax JSON reliably. Pull `qwen2.5:7b-instruct`
   or `gemma3:12b-it-q4_K_M` and retry.
2. **Lower the chunker target.** `chunker.target_tokens=400` gives
   the model a smaller context to chew on per call.
3. **Look at the raw LLM output.** Set `--log-level DEBUG` and the
   parser's rejects show up verbatim. If the LLM is wrapping JSON
   in prose, the tolerant parser usually recovers; if it is emitting
   something entirely different ("Sure, here are some facts:..."),
   the model is the wrong choice for structured tasks.

## "AnkiConnect unreachable" warning

This is informational, not an error. mneme falls back to writing a
`.apkg` file. To silence the warning either:

- Start Anki with the AnkiConnect add-on (id 2055492159) loaded, or
- Pass `--no-ankiconnect` on the CLI, or
- Set `config.anki.use_ankiconnect=False` in YAML.

## "Ollama call failed (attempt N/M)"

Three usual causes:

- **Daemon not running.** `mneme doctor` confirms this. Start it
  with `ollama serve` or via your platform's launchpad.
- **Model not pulled.** `mneme models` shows what is on the daemon;
  pull what you need.
- **Request timeout.** The default is 120 seconds. Large 14B+ models
  on CPU can exceed that on the first call as the model loads.
  Bump `config.llm.request_timeout_s` (or `MNEME_LLM_REQUEST_TIMEOUT_S=300`).

## Deduplicator collapses cards I wanted to keep

The threshold is `embedding.dedup_threshold` (default 0.85). Raise it
to keep more paraphrases (`0.90` keeps near-duplicates that share
specific terminology). Re-running with the new threshold is
deterministic.

You can also turn dedup off entirely with
`config.embedding.backend="none"`, which skips the stage. The
quality filter will still drop the worst paraphrases on its own.

## Tsetlin difficulty backend silently falls back to heuristic

`mneme doctor` flags this as "tsetlin backend unavailable" in the
log. Two causes:

1. `tmu` is not installed. `pip install "mneme[tm]"` adds it.
2. `config.difficulty.backend="tsetlin"` was set but
   `config.difficulty.model_path` is empty. The TM has to be
   trained from labelled data first; see
   `examples/train_difficulty_classifier.py`.

The fallback is graceful: the heuristic backend produces the same
shape of output (a class + a rationale) so the pipeline keeps
running.

## Embedding model download stalls

The default `sentence-transformers` backend downloads
`BAAI/bge-small-en-v1.5` (~130 MB) on first use. The download lives
in `~/.cache/mneme/models` and is cached for subsequent runs. If
the download is blocked by your network, switch to the TF-IDF
fallback:

```yaml
embedding:
  backend: tfidf-fallback
```

The fallback is pure Python, has no model to download, and produces
slightly weaker dedup quality (the README's "How it compares" table
notes the trade-off).

## .apkg fails to import in Anki

Two causes seen so far:

1. **Anki version too old.** The exporter targets schema 11 which
   Anki >= 2.1.50 reads. Older Anki versions will refuse the file.
2. **Deck name has a forward slash.** Anki interprets `/` as a
   subdeck separator. mneme escapes slashes in the file name but
   keeps them in the deck name, which is usually what the user
   wants. If that is not what you want, set `--deck-name` explicitly.

## CLI says "command not found: mneme"

The `mneme` console script is installed by `pip install -e .`. If
you installed with `python setup.py install` or with an older
toolchain, the entry point may not be on PATH. Run
`python -m mneme ...` instead, which is equivalent.

## Where do I find the run summary?

By default it sits next to the `.apkg` file with a `.summary.json`
suffix. The CLI also prints the path in its final JSON output
under `summary_path`. Pass `--summary <path>` to override.

## Still stuck?

Open an issue with the
[bug-report template](https://github.com/AnwarDebes/Mneme-Education-Ecosystem/issues/new?template=bug_report.md).
Include the source file (a paragraph is enough if your real source
is private), the exact CLI invocation, and the `.summary.json`.
That trio fixes most bugs in one round.
