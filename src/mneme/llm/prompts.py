"""Prompt templates.

Prompts are versioned strings rather than .txt files so they
travel with the code and round-trip through the test suite.
Each function returns a tuple ``(system, user)`` so the LLM
backend can place them in the right slot.

Versioning rule: bump ``PROMPT_VERSION`` whenever a template changes
semantically. The version is logged in :class:`mneme.types.RunSummary`
so old runs can be reproduced.
"""
from __future__ import annotations

from .. import __version__ as _LIB_VERSION

PROMPT_VERSION = "1"


# ---------------------------------------------------------------------------
# Atomic fact extraction
# ---------------------------------------------------------------------------

_ATOMIC_FACTS_SYSTEM = """\
You are an expert at extracting atomic factual claims from educational text.

An atomic claim is:
- a single, self-contained statement that can be understood without context,
- expressed as a complete declarative sentence,
- specific (names, dates, values; not "it depends" or "various authors").

Return ONLY valid JSON. Do not include any prose before or after the JSON.
"""


def atomic_facts_prompt(chunk_text: str, max_facts: int = 8) -> tuple[str, str]:
    user = f"""\
Extract up to {max_facts} atomic factual claims from the text below.
Skip:
- opinions and subjective statements,
- examples and illustrations,
- statements containing pronouns whose referent is unclear,
- restatements of an already-extracted fact (same subject AND same object
  in a different phrasing counts as a restatement).

Each fact must add NEW information compared to the facts you have
already extracted. If a stoichiometric ratio, named entity, or
location appears in more than one sentence, extract it ONCE in its
most general form.

Return a JSON array (square brackets), even if you extract only one fact.
Do NOT return a single bare object. Do NOT wrap the array in another object.
Each element must be an object with keys:
- "fact": the atomic claim as a complete sentence
- "rationale": one short clause explaining why this is a factual claim
- "confidence": float in [0, 1]

Example output for two facts:
[
  {{"fact": "Water boils at 100 degrees Celsius at sea level.", "rationale": "Standard physical constant.", "confidence": 1.0}},
  {{"fact": "Mount Everest is 8848 metres tall.", "rationale": "Geographic measurement.", "confidence": 0.95}}
]

Text:
\"\"\"
{chunk_text}
\"\"\"
"""
    return _ATOMIC_FACTS_SYSTEM, user


# ---------------------------------------------------------------------------
# Q/A card generation
# ---------------------------------------------------------------------------

_QA_GENERATION_SYSTEM = """\
You are an expert at writing flashcards for spaced repetition.

Your job is to convert an atomic factual claim into one or more
question-answer pairs that test recall of the key information.

Rules:
- One key idea per card (the "minimum information principle").
- Concrete, unambiguous question.
- Short answer (one phrase or value; one sentence at most).
- No yes-or-no questions.
- No "what is X" questions whose answer just repeats X verbatim.
- Use the same language as the source fact.
- The answer must follow directly from the provided fact. Do NOT
  introduce information that is not in the fact, even if it would
  otherwise be true. Stay grounded in the source.

Return ONLY valid JSON. No prose before or after.
"""


def qa_generation_prompt(fact_text: str, max_cards: int = 2) -> tuple[str, str]:
    user = f"""\
Write up to {max_cards} flashcards for the following atomic fact.

Return a JSON array (square brackets), even if you write only one card.
Do NOT return a single bare object. Do NOT wrap the array in another object.
Each element must be an object with keys:
- "question": the prompt that elicits the answer
- "answer": the concise answer
- "tags": optional list of short topical tags

Example output for one card:
[{{"question": "What is the capital of France?", "answer": "Paris", "tags": ["geography"]}}]

Fact:
\"\"\"
{fact_text}
\"\"\"
"""
    return _QA_GENERATION_SYSTEM, user


# ---------------------------------------------------------------------------
# Cloze card generation
# ---------------------------------------------------------------------------


_CLOZE_GENERATION_SYSTEM = """\
You are an expert at writing cloze-deletion flashcards for spaced repetition.

A cloze-deletion card hides one or more key terms inside a sentence
using the Anki marker syntax `{{c1::term}}`, `{{c2::another}}`, etc.
The studier sees the sentence with one marker hidden and must recall
the hidden term.

Rules:
- The cloze sentence must be a complete, self-contained statement.
- Delete the most diagnostic term(s): proper nouns, numbers, dates,
  domain-specific vocabulary. Do NOT delete function words.
- Prefer one or two deletions per card. Never more than three.
- Each numbered marker (c1, c2, ...) generates one card. Reuse the
  same number to delete two terms together when they belong to the
  same atomic concept.
- The sentence outside the markers must remain grammatical.
- Do not delete the same surface form twice in one sentence with
  different numbers; choose one of them.

Return ONLY valid JSON. No prose before or after.
"""


def cloze_generation_prompt(fact_text: str, max_cards: int = 2) -> tuple[str, str]:
    user = f"""\
Write up to {max_cards} cloze-deletion flashcards from the atomic fact below.

Return a JSON array (square brackets), even if you write only one card.
Each element must be an object with keys:
- "cloze": the full sentence with `{{{{c1::term}}}}` markers around the deleted terms
- "tags": optional list of short topical tags

Example output:
[{{"cloze": "Mitochondria produce {{{{c1::ATP}}}} via {{{{c2::cellular respiration}}}}.", "tags": ["biology"]}}]

Fact:
\"\"\"
{fact_text}
\"\"\"
"""
    return _CLOZE_GENERATION_SYSTEM, user


# ---------------------------------------------------------------------------
# Optional LLM-based quality check (slow; opt-in)
# ---------------------------------------------------------------------------

_QUALITY_CHECK_SYSTEM = """\
You are a strict reviewer of educational flashcards. Score a card on:
- clarity (is the question unambiguous?),
- specificity (does the answer contain the key information?),
- conciseness (can a reader recall the answer in under 10 seconds?),
- factuality (assuming the supplied fact is true, does the card preserve it?).

Return ONLY valid JSON. No prose before or after.
"""


def quality_check_prompt(question: str, answer: str, source_fact: str) -> tuple[str, str]:
    user = f"""\
Score this flashcard. Return a JSON object with keys:
- "clarity": 1-5
- "specificity": 1-5
- "conciseness": 1-5
- "factuality": 1-5
- "overall": float in [0, 1]
- "issues": list of short strings naming any problems

Fact:
\"\"\"
{source_fact}
\"\"\"
Question: {question}
Answer: {answer}
"""
    return _QUALITY_CHECK_SYSTEM, user


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------


def prompt_provenance() -> dict[str, str]:
    """Returned and logged at the end of every run."""
    return {
        "library_version": _LIB_VERSION,
        "prompt_version": PROMPT_VERSION,
    }
