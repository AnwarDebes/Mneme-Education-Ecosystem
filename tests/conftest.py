"""Shared pytest fixtures.

Adds the src/ directory to the import path so the tests can ``import
mneme`` without a pip install. Also exposes a ``tmp_text_file`` fixture
that materialises a tiny educational paragraph for the extraction
tests to chew on.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


@pytest.fixture
def sample_text() -> str:
    return (
        "# Photosynthesis\n\n"
        "Photosynthesis is the process by which green plants convert "
        "sunlight, water, and carbon dioxide into glucose and oxygen.\n\n"
        "It occurs primarily in the chloroplasts of plant cells, where "
        "the green pigment chlorophyll absorbs light energy.\n\n"
        "## Stages\n\n"
        "There are two main stages: the light-dependent reactions and "
        "the Calvin cycle. The light-dependent reactions take place "
        "in the thylakoid membrane and produce ATP and NADPH.\n"
    )


@pytest.fixture
def tmp_text_file(tmp_path, sample_text):
    p = tmp_path / "sample.md"
    p.write_text(sample_text, encoding="utf-8")
    return p
