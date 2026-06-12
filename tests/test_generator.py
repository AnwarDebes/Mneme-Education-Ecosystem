"""Tests for the fact extractor and card generator using a mock LLM."""
from __future__ import annotations

import json

from mneme.cards.generator import CardGenerator, FactExtractor
from mneme.llm.backend import MockBackend
from mneme.types import AtomicFact, Chunk


def test_fact_extractor_parses_canned_response():
    canned = json.dumps([
        {"fact": "Photosynthesis converts sunlight into chemical energy.", "confidence": 0.9},
        {"fact": "Chlorophyll absorbs light primarily in the red and blue bands.", "confidence": 0.8},
    ])
    backend = MockBackend(responses=[canned])
    chunk = Chunk(index=0, text="Photosynthesis ...")
    facts = FactExtractor(backend).extract([chunk])
    assert len(facts) == 2
    assert facts[0].source_chunk == 0
    assert "Photosynthesis" in facts[0].fact


def test_fact_extractor_swallows_invalid_json():
    backend = MockBackend(responses=["this is not json"])
    chunk = Chunk(index=0, text="some text")
    facts = FactExtractor(backend).extract([chunk])
    assert facts == []


def test_card_generator_parses_canned_response():
    canned = json.dumps([
        {"question": "What is photosynthesis?",
         "answer": "Conversion of light, water, and CO2 into glucose and oxygen.",
         "tags": ["biology"]},
    ])
    backend = MockBackend(responses=[canned])
    fact = AtomicFact(fact="Photosynthesis is the conversion of light ...", source_chunk=0)
    cards = CardGenerator(backend).generate([fact])
    assert len(cards) == 1
    assert cards[0].source_fact.startswith("Photosynthesis")
    assert "biology" in cards[0].tags


def test_card_generator_skips_empty_cards():
    canned = json.dumps([
        {"question": "", "answer": ""},
        {"question": "Real question?", "answer": "Real answer"},
    ])
    backend = MockBackend(responses=[canned])
    fact = AtomicFact(fact="something true", source_chunk=0)
    cards = CardGenerator(backend).generate([fact])
    assert len(cards) == 1


# ---------------------------------------------------------------------------
# Regression tests for the json_mode tolerance fix
# (Gemma 3 and several Llama variants return a single object or a
# wrapped object even when the prompt asks for an array. The generator
# must accept all three shapes; see _coerce_to_list in generator.py.)
# ---------------------------------------------------------------------------


def test_fact_extractor_accepts_single_bare_object():
    """Gemma 3 12B returns a single object instead of an array.

    The generator should wrap a single record in a one-element list
    rather than dropping it on the floor.
    """
    canned = json.dumps({
        "fact": "Mitochondria are the powerhouse of the cell.",
        "confidence": 0.95,
    })
    backend = MockBackend(responses=[canned])
    facts = FactExtractor(backend).extract([Chunk(index=0, text="...")])
    assert len(facts) == 1
    assert facts[0].fact.startswith("Mitochondria")


def test_fact_extractor_accepts_wrapped_object():
    """Some models wrap the array under a key like {'facts': [...]}."""
    canned = json.dumps({
        "facts": [
            {"fact": "Water boils at 100 C at sea level.", "confidence": 1.0},
            {"fact": "Ice melts at 0 C.", "confidence": 1.0},
        ]
    })
    backend = MockBackend(responses=[canned])
    facts = FactExtractor(backend).extract([Chunk(index=0, text="...")])
    assert len(facts) == 2


def test_fact_extractor_accepts_alternative_wrap_keys():
    for key in ("results", "items", "data", "atomic_facts"):
        canned = json.dumps({key: [{"fact": "A test fact about gravity.", "confidence": 0.9}]})
        backend = MockBackend(responses=[canned])
        facts = FactExtractor(backend).extract([Chunk(index=0, text="...")])
        assert len(facts) == 1, f"key {key!r} did not unwrap"


def test_card_generator_accepts_single_bare_object():
    canned = json.dumps({
        "question": "What is the chemical symbol for water?",
        "answer": "H2O",
        "tags": ["chemistry"],
    })
    backend = MockBackend(responses=[canned])
    fact = AtomicFact(fact="Water is H2O.", source_chunk=0)
    cards = CardGenerator(backend).generate([fact])
    assert len(cards) == 1
    assert cards[0].answer == "H2O"


def test_card_generator_accepts_fenced_markdown_json():
    """Local LLMs without json_mode tend to wrap output in ```json ... ```."""
    fenced = """Here's the card:

```json
[{"question": "Name the green pigment in chloroplasts.", "answer": "Chlorophyll"}]
```
"""
    backend = MockBackend(responses=[fenced])
    fact = AtomicFact(fact="Chloroplasts contain chlorophyll.", source_chunk=0)
    cards = CardGenerator(backend).generate([fact])
    assert len(cards) == 1


def test_card_generator_skips_garbled_payload_gracefully():
    """When the LLM produces text-with-no-JSON, we drop silently rather than crashing."""
    backend = MockBackend(responses=["I cannot comply with this request."])
    fact = AtomicFact(fact="Anything.", source_chunk=0)
    cards = CardGenerator(backend).generate([fact])
    assert cards == []
