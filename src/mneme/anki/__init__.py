"""Anki output module.

Two backends:

- :class:`AnkiConnectClient`: pushes cards into a running Anki via the
  AnkiConnect plugin (add-on 2055492159).
- :class:`ApkgExporter`: writes a portable .apkg file that the user
  can import by double-clicking. Used when AnkiConnect is unavailable
  or the user just wants a standalone deck.
"""
from .ankiconnect import AnkiConnectClient, AnkiConnectError
from .apkg import ApkgExporter

__all__ = ["AnkiConnectClient", "AnkiConnectError", "ApkgExporter"]
