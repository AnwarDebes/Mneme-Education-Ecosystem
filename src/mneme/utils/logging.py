"""Simple logging setup.

A single ``configure_logging`` entry point that wires the
``logging`` stdlib to a colourful (when stderr is a tty) human-
friendly formatter. Used by the CLI; library users keep their own
logging setup.
"""
from __future__ import annotations

import logging
import os
import sys

_FMT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"
_DATEFMT = "%H:%M:%S"


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if root.handlers:
        # Don't add a second handler if the user already configured logging.
        root.setLevel(level)
        return
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_Formatter(_FMT, datefmt=_DATEFMT))
    root.addHandler(handler)
    root.setLevel(level)


class _Formatter(logging.Formatter):
    """Adds ANSI colour to level names when stderr is a tty."""

    _LEVEL_COLORS = {
        "DEBUG": "\x1b[36m",
        "INFO": "\x1b[32m",
        "WARNING": "\x1b[33m",
        "ERROR": "\x1b[31m",
        "CRITICAL": "\x1b[35m",
    }
    _RESET = "\x1b[0m"
    _USE_COLOR = sys.stderr.isatty() and os.environ.get("NO_COLOR", "") == ""

    def format(self, record: logging.LogRecord) -> str:
        if self._USE_COLOR:
            color = self._LEVEL_COLORS.get(record.levelname, "")
            record.levelname = f"{color}{record.levelname}{self._RESET}"
        return super().format(record)
