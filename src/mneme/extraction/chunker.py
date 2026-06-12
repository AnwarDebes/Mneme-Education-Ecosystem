"""Semantic chunker.

Splits a document into chunks the LLM can process one at a time. The
default strategy is heading-aware: chunks try to start on heading
boundaries (Markdown ``#``, all-caps lines, numbered sections),
respect paragraph boundaries when possible, and cap themselves at a
target token count with a small overlap so atomic facts spanning a
chunk boundary survive at least once.

Token counting is approximate (4 characters per token) so the package
does not require a tokenizer model. The approximation is fine for
chunk-size budgeting; the LLM never sees the approximate count.
"""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable

from ..config import ChunkerConfig
from ..types import Chunk

log = logging.getLogger(__name__)


# Cheap token approximation: 1 token ~ 4 characters for English. Off
# by ~25% on code and ~50% on dense math, but good enough for chunk
# sizing decisions where we want a soft target.
def approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


# Heading patterns we recognise.
_MD_HEADING = re.compile(r"^(#{1,6})\s+(.*)$", re.MULTILINE)
_NUMBERED_HEADING = re.compile(r"^(\d+(?:\.\d+)*)\s+([A-Z][^\n]{1,120})$", re.MULTILINE)
_ALL_CAPS_HEADING = re.compile(r"^([A-Z][A-Z0-9\s\-:]{4,80})$", re.MULTILINE)
_PARAGRAPH_BREAK = re.compile(r"\n{2,}|\f")


class Chunker:
    """Split documents into chunks the LLM can process.

    Parameters
    ----------
    config:
        :class:`mneme.config.ChunkerConfig` instance. Defaults to a
        sensible 600-token chunk with 60-token overlap if not supplied.
    """

    def __init__(self, config: ChunkerConfig | None = None) -> None:
        self.config = config or ChunkerConfig()

    def chunk(self, text: str) -> list[Chunk]:
        """Return a list of :class:`Chunk` covering ``text``."""
        text = self._normalise(text)
        sections = list(self._split_into_sections(text))
        chunks: list[Chunk] = []
        char_cursor = 0
        for section_title, section_body in sections:
            for piece in self._pack_section(section_body):
                # Re-locate the piece within the original text for
                # provenance. Linear scan is fine because we only
                # advance forward.
                pos = text.find(piece, char_cursor)
                if pos < 0:
                    pos = char_cursor
                char_start = pos
                char_end = pos + len(piece)
                char_cursor = char_end
                chunks.append(
                    Chunk(
                        index=len(chunks),
                        text=piece,
                        char_start=char_start,
                        char_end=char_end,
                        section=section_title,
                        token_count=approx_tokens(piece),
                    )
                )
        log.info("chunked %d chars into %d chunks", len(text), len(chunks))
        return chunks

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _normalise(text: str) -> str:
        # Collapse Windows newlines, strip trailing whitespace per line,
        # squash 3+ consecutive blank lines down to 2.
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = "\n".join(line.rstrip() for line in text.split("\n"))
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text

    def _split_into_sections(self, text: str) -> Iterable[tuple[str | None, str]]:
        """Yield ``(section_title, body)`` pairs.

        Tries each heading regex in order. If none fire we yield a
        single section with title ``None``.
        """
        if not self.config.respect_headings:
            yield None, text
            return

        # Find all heading positions across all regexes.
        positions: list[tuple[int, str]] = []
        for m in _MD_HEADING.finditer(text):
            positions.append((m.start(), m.group(2).strip()))
        for m in _NUMBERED_HEADING.finditer(text):
            positions.append((m.start(), f"{m.group(1)} {m.group(2)}".strip()))
        for m in _ALL_CAPS_HEADING.finditer(text):
            # Avoid matching the same line twice with the MD or numbered
            # regex; we check distance to other positions.
            if any(abs(p - m.start()) < 5 for p, _ in positions):
                continue
            positions.append((m.start(), m.group(1).strip()))

        if not positions:
            yield None, text
            return

        positions.sort(key=lambda x: x[0])
        # Prepend a virtual "section 0" if the file starts with content
        # before the first heading.
        if positions[0][0] > 0:
            yield None, text[: positions[0][0]].strip()
        for i, (start, title) in enumerate(positions):
            end = positions[i + 1][0] if i + 1 < len(positions) else len(text)
            yield title, text[start:end].strip()

    def _pack_section(self, body: str) -> Iterable[str]:
        """Pack one section into chunks of at most ``target_tokens``.

        Splits on paragraph boundaries first, then packs paragraphs
        greedily into chunks. If a single paragraph exceeds the
        target it is split on sentence boundaries.
        """
        if approx_tokens(body) <= self.config.target_tokens:
            if len(body) >= self.config.min_chunk_chars or len(body) > 0:
                yield body
            return

        paragraphs = [p.strip() for p in _PARAGRAPH_BREAK.split(body) if p.strip()]
        current: list[str] = []
        current_tokens = 0
        for para in paragraphs:
            para_tokens = approx_tokens(para)
            if para_tokens > self.config.target_tokens:
                # Flush current.
                if current:
                    yield "\n\n".join(current)
                    current = []
                    current_tokens = 0
                yield from self._split_long_paragraph(para)
                continue
            if current_tokens + para_tokens > self.config.target_tokens:
                yield "\n\n".join(current)
                # Overlap: keep last paragraph as the seed of the next chunk.
                if self.config.overlap_tokens > 0 and current:
                    seed = current[-1]
                    current = [seed]
                    current_tokens = approx_tokens(seed)
                else:
                    current = []
                    current_tokens = 0
            current.append(para)
            current_tokens += para_tokens
        if current:
            yield "\n\n".join(current)

    def _split_long_paragraph(self, paragraph: str) -> Iterable[str]:
        """Split a paragraph that exceeds the target on sentence boundaries."""
        sentences = _split_sentences(paragraph)
        current: list[str] = []
        current_tokens = 0
        for s in sentences:
            t = approx_tokens(s)
            if current_tokens + t > self.config.target_tokens and current:
                yield " ".join(current)
                current = []
                current_tokens = 0
            current.append(s)
            current_tokens += t
        if current:
            yield " ".join(current)


_SENT_SPLIT = re.compile(r"(?<=[\.\!\?])\s+(?=[A-Z\(\"\'])")


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]
