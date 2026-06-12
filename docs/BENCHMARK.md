# Benchmark protocol

The README marks the hand-graded benchmark on real textbook chapters
as **not yet run**. This document describes the protocol the project
commits to running, so the eventual numbers are reproducible and the
methodology is open for criticism before it is executed.

## What we measure

Three numbers per source, averaged across sources:

1. **Card quality (1-5)**: a human grader scores each card on a
   five-point Likert scale (1 = misleading, 5 = textbook-grade).
   Aggregated as the median (more robust than the mean to a few
   awful cards).
2. **Card factuality (yes/no)**: does the answer follow from the
   source chunk? Computed as the fraction of cards a grader marks
   as factually grounded.
3. **Coverage (% of human-rated key facts hit)**: a separate pass
   in which the same grader writes their own list of "key facts"
   from the source, then checks how many a mneme card covers.

These three metrics together capture the three failure modes worth
worrying about: bad cards, wrong cards, and missed material.

## What we hold constant

To make the numbers comparable across runs:

- **Sources**: three textbook chapters spanning three domains:
  - a biology chapter (Campbell, Photosynthesis),
  - a law chapter (a publicly-available EU AI Act analysis),
  - a programming chapter (one chapter of CRACKING the Coding
    Interview's algorithm review).
- **Model**: `qwen2.5:7b-instruct` and `gemma3:12b-it-q4_K_M` are
  both reported, separately. No cherry-picking between models per
  source.
- **Prompts**: the production prompts in `src/mneme/llm/prompts.py`
  at the version recorded in the run summary. No per-source prompt
  tuning.
- **Config**: the default `Config()` plus `embedding.dedup_threshold=0.85`.
- **Random seed**: 42, the library default.

## What we report

For each (source, model) pair, the run summary JSON is included in
the benchmark directory under `results/benchmarks/<model>/<source>.summary.json`,
and the grading sheet is included as
`results/benchmarks/<model>/<source>.grades.csv`.

A summary table lands in `docs/BENCHMARK.md` (this file) once the
runs complete. Until then, this file documents the protocol.

## Grader workflow

1. Grader reads the source chapter once before opening the cards.
2. Grader writes their own key-facts list (15-25 facts per chapter)
   before seeing mneme's output. This prevents anchoring.
3. Grader opens the generated cards, scores each on the 1-5 scale,
   marks factuality, and notes any card whose answer is not in the
   source.
4. Grader cross-references their key-facts list with the card set
   to compute coverage.

Total grader time: 2-3 hours per chapter. The grading sheets are
public so future contributors can re-grade with a different rubric.

## How to reproduce

When the benchmark exists:

```bash
git clone https://github.com/AnwarDebes/Mneme-Education-Ecosystem.git
cd mneme
pip install -e ".[embeddings,tm]"

# Pull the two models
ollama pull qwen2.5:7b-instruct
ollama pull gemma3:12b-it-q4_K_M

# Run the benchmark script
python scripts/run_benchmark.py --output-dir results/benchmarks
```

`scripts/run_benchmark.py` is part of the v0.2 milestone; the README
will be updated when the script and the numbers are ready.

## Why not a fully automated benchmark?

Two reasons:

1. **The right metric for cards is human judgement.** LLM-as-judge
   evaluations on educational content correlate poorly with how
   useful a card actually is for spaced repetition. The slow path
   (a real human reading a real chapter) is the path that produces
   numbers you can act on.
2. **Anchoring.** A grader who has already seen mneme's cards
   cannot write an unbiased key-facts list. Splitting the workflow
   (key facts first, cards second) costs an hour and is worth it.

A separate, fully automated faithfulness check (does each answer
appear verbatim or near-verbatim in the source?) lives in
`tests/test_quality.py` and runs on every commit. That is a lower
bar than the hand grade but a fast signal during development.
