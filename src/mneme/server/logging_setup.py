"""Centralised logging configuration for the server.

Two formats are supported:

* ``MNEME_LOG_FORMAT=text`` (default) - human readable, the historical
  output you got with ``logging.basicConfig`` in app.py.
* ``MNEME_LOG_FORMAT=json`` - one JSON object per line, suitable for
  shipping to log aggregators without a regex parser. ``extra`` keys
  passed via ``log.info("msg", extra={"k": v})`` are included.

The level is taken from ``MNEME_LOG_LEVEL`` and defaults to ``INFO``.
Configuration is idempotent - call ``configure_logging`` multiple times
safely.
"""

from __future__ import annotations

import json
import logging
import os
import sys


class _JSONFormatter(logging.Formatter):
    # Fields that the standard LogRecord always carries; everything else
    # in __dict__ is treated as user-supplied ``extra`` and surfaced.
    _SKIP = {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName",
        "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key, val in record.__dict__.items():
            if key in self._SKIP or key.startswith("_"):
                continue
            try:
                json.dumps(val)
                payload[key] = val
            except (TypeError, ValueError):
                payload[key] = repr(val)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    level_name = os.environ.get("MNEME_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    fmt = os.environ.get("MNEME_LOG_FORMAT", "text").lower()

    root = logging.getLogger()
    # Clear any handlers a prior basicConfig left behind so we don't
    # double-log when the server reloads.
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"),
        )
    root.addHandler(handler)
    root.setLevel(level)
