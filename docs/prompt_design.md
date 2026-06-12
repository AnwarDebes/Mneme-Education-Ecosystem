# Prompt design

The two production prompts live in `src/mneme/llm/prompts.py` as
Python strings. This document explains the reasoning behind their
current shape so future changes do not regress on quality.

## Why two prompts, not one

A single prompt that produces flashcards directly from a chunk is
tempting but inferior. With two stages the model can:

- Concentrate on factual extraction in stage 1 (high precision,
  low recall is fine; we can discard borderline claims).
- Concentrate on card writing in stage 2 (one fact -> one card; the
  cognitive load on the model is smaller).

Two stages also let us cache the output of stage 1 across re-runs
when the chunk is unchanged. The same source typed text re-runs at
zero LLM cost from the second invocation onwards.

## Stage 1: atomic facts

Each atomic fact must be a "self-contained declarative sentence
expressing a single factual claim". The prompt enforces this with
three skips:

1. Skip opinions and subjective statements.
2. Skip examples and illustrations.
3. Skip statements containing pronouns whose referent is unclear.

The structured JSON output (with an optional `rationale` field) lets
us log the model's reasoning for debugging without surfacing it to
the user.

## Stage 2: Q/A cards

The card prompt's most important rule is the **minimum information
principle** (one key idea per card). It is the single best predictor
of long-term recall in spaced repetition, more important than the
exact wording of the question.

Two anti-patterns are explicitly forbidden:

- Yes-or-no questions ("Is photosynthesis a process?"). They carry
  too little information per card.
- "What is X?" questions whose answer just repeats X verbatim. They
  are a common LLM failure mode and the heuristic quality filter
  catches what slips through.

## Quality check (off by default)

A third prompt (`quality_check_prompt`) returns a structured score
on four axes (clarity, specificity, conciseness, factuality). It is
off by default because it doubles the LLM cost. Turn it on with
`QualityConfig.use_llm_quality = True` (planned for v0.2).

## Versioning

`PROMPT_VERSION` is a single string in `prompts.py`. Bump it whenever
a template changes semantically (not for typo fixes). The run
summary records the version so old decks can be reproduced exactly.
