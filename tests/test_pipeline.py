"""End-to-end pipeline test using the MockBackend.

No GPU, no Ollama, no AnkiConnect, no network. The pipeline is wired
with a deterministic mock LLM and runs the full chunker -> fact ->
card -> quality -> dedup -> difficulty -> .apkg path on a tiny
markdown source.
"""
from __future__ import annotations

import json

from mneme.config import Config
from mneme.llm.backend import MockBackend
from mneme.pipeline import Pipeline
from mneme.types import Source, SourceKind


def _canned_routes() -> dict[str, str]:
    # Routed mode: the mock returns different payloads depending on
    # whether the prompt asks for atomic facts or for cards. The
    # substring keys correspond to phrases in the prompt templates.
    facts_resp = json.dumps([
        {"fact": "Photosynthesis converts sunlight into glucose and oxygen.", "confidence": 0.9},
        {"fact": "Chlorophyll absorbs light energy in chloroplasts.", "confidence": 0.85},
    ])
    qa_resp = json.dumps([
        {"question": "What does photosynthesis convert sunlight into?",
         "answer": "Glucose and oxygen",
         "tags": ["biology"]},
    ])
    return {
        "Extract up to": facts_resp,
        "Write up to": qa_resp,
    }


def test_pipeline_end_to_end_with_mock_llm(tmp_text_file, tmp_path):
    config = Config()
    # Use the TF-IDF fallback backend so we do not download a model.
    config.embedding.backend = "tfidf-fallback"
    config.anki.use_ankiconnect = False
    config.anki.apkg_export_path = str(tmp_path / "out.apkg")

    mock = MockBackend(routes=_canned_routes())
    pipeline = Pipeline(config, llm=mock)

    source = Source(kind=SourceKind.MARKDOWN, path=str(tmp_text_file))
    summary = pipeline.run(source)

    assert summary.cards_emitted >= 1
    assert summary.apkg_path is not None
    assert summary.deck_name is not None
    # Every card should carry a difficulty (heuristic backend).
    assert any(stage.name == "difficulty" for stage in summary.stages)
    # The summary should be JSON-serialisable.
    json.loads(summary.model_dump_json())


def test_pipeline_handles_zero_facts_gracefully(tmp_text_file, tmp_path):
    config = Config()
    config.embedding.backend = "tfidf-fallback"
    config.anki.use_ankiconnect = False
    config.anki.apkg_export_path = str(tmp_path / "out.apkg")

    # The mock returns empty arrays for every call: no facts, no cards.
    mock = MockBackend(responses=["[]"] * 100)
    summary = Pipeline(config, llm=mock).run(Source(kind=SourceKind.MARKDOWN, path=str(tmp_text_file)))
    assert summary.cards_emitted == 0
