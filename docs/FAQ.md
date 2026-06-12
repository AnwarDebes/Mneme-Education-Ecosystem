# FAQ

Questions that come up enough times that they belong in the repo.
If your question isn't here, open a
[discussion](https://github.com/AnwarDebes/Mneme-Education-Ecosystem/discussions) or an
[issue](https://github.com/AnwarDebes/Mneme-Education-Ecosystem/issues/new/choose).

## Setup

### Do I need a GPU?

For the mneme library itself, no. The library spends its time in I/O
(reading the source, talking to Ollama, writing the .apkg). The LLM
runs inside Ollama, and Ollama can do CPU-only inference at the cost
of speed. If you want sub-minute runs on a textbook chapter, a GPU
that holds a 7B-class model is helpful.

The optional sentence-transformers embedding backend will use your
GPU if `torch` finds one; otherwise it falls back to CPU.

### Which Ollama model should I use?

Defaults are tuned for `qwen2.5:7b-instruct`. Other working choices:

| Model | Strength | Trade-off |
|---|---|---|
| `qwen2.5:7b-instruct` | best general quality at 7B | the default |
| `gemma3:12b-it-q4_K_M` | best small-model quality I've measured | needs ~8GB VRAM |
| `llama3.1:8b-instruct` | broadly available | slightly weaker on dense chapters |
| `qwen2.5:14b-instruct` | catches subtler facts | ~12GB VRAM, slower |

Anything below 4B parameters tends to hallucinate facts that are not
in the source. mneme will run with smaller models, but the output
needs more human review.

### Can I use mneme without Ollama?

For the pipeline, no. The library is local-first and Ollama is the
local LLM runtime. You can however verify the library wiring without
any local LLM by running `mneme demo`, which uses a deterministic
`MockBackend`.

### Does mneme work without Anki installed?

Yes. With AnkiConnect unavailable, mneme writes a portable `.apkg`
file that the user double-clicks to import into Anki later.
`mneme build my.pdf --no-ankiconnect --apkg out.apkg` is the explicit
form.

## Quality

### Why are some cards weaker than others?

The pipeline is honest about its uncertainty. Every card carries a
`quality_score` from the heuristic filter and a `difficulty_rationale`
from the difficulty classifier. Use the rationale to spot weak cards:
the most common pattern is a long, listy answer (the model failed to
split into multiple cards) or a card flagged as a definitional loop
that slipped through.

A simple post-run review of cards with `quality_score < 0.5` catches
most of the problems.

### Why did the deduplicator drop a card I wanted to keep?

The threshold (`embedding.dedup_threshold`, default 0.85) is a tunable
knob. Lower it (down to 0.80) and more paraphrases collapse; raise it
(up to 0.92) and only near-identical cards merge. Re-run with the new
threshold; the deduplicator is deterministic so the same setting
always produces the same partition.

### Why is the same fact extracted twice?

That is the fact extractor not being aggressive enough about its
own deduplication. The current prompt asks the model to skip
restatements within a chunk, but identical facts across chunks slip
through because each chunk is generated independently. The
deduplicator catches these at the card level by embedding similarity.
If you see exact textual duplicates that the deduplicator missed,
report it as a bug with the input chunk.

## Reproducibility

### Will two runs on the same source produce the same cards?

Yes when `config.deterministic` is True (the default) and the same
seed is used, **provided the LLM is deterministic**. Ollama honours
the `seed` option when temperature is fixed, so practical
reproducibility is good. The chunker, quality filter, deduplicator,
and difficulty classifier are all deterministic by construction.

### What ships in the run summary?

Every run writes a JSON file next to the `.apkg` containing:

- mneme library version,
- prompt template version,
- the full config snapshot (so old runs reproduce after a config drift),
- per-stage input / output counts and elapsed time,
- the deck name and Anki note ids (if AnkiConnect was used),
- the .apkg path (if exported).

This is the audit trail. Six months later, the summary tells you
exactly which model and which prompt produced each card.

## Privacy

### Where does my source content go?

Through the chunker (in-process), to the Ollama HTTP endpoint
(default `localhost:11434`), and to either AnkiConnect
(`localhost:8765`) or the `.apkg` file you specified. No third-party
service is contacted unless you explicitly point the LLM backend at
a remote URL.

### Does mneme phone home?

No. There is no telemetry, no analytics, no update check. The
optional FastAPI server only listens for the local frontend; it does
not call out.

## Extending

### Can I plug in my own LLM backend?

Yes. Implement `mneme.llm.backend.LLMBackend` (a one-method Protocol)
and pass an instance to `Pipeline(config, llm=my_backend)`.
See [`docs/EXTENDING.md`](EXTENDING.md) and
[`examples/custom_llm_backend.py`](../examples/custom_llm_backend.py)
for a worked example.

### Can I change the prompts?

The two production prompts live in `src/mneme/llm/prompts.py` as
Python strings. Bump `PROMPT_VERSION` when you change them
semantically so the run summary records the change. Treat prompt
edits like code: PR them with a test.

### Can mneme generate cloze, image, or audio cards?

The v0.1 output is Basic (front / back) only. Cloze + media support
is on the roadmap for v0.2; see the `Component | State` table in the
README. If you want cloze cards now, the cleanest route is to add a
new `note_type` in the .apkg exporter and a corresponding template.
