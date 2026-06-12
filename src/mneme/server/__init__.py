"""FastAPI server exposing mneme as a REST + SSE API.

The frontend (mneme/frontend) talks to this server. The server itself
is a thin wrapper around the existing :class:`mneme.Pipeline`: every
endpoint is composed from the same code paths the CLI uses, so the
two stay in sync.

Run with::

    uvicorn mneme.server.app:app --reload --port 8000

The Next.js frontend defaults to ``http://localhost:8000`` for its
API base URL (overridable via ``NEXT_PUBLIC_API_BASE``).
"""
from .app import app

__all__ = ["app"]
