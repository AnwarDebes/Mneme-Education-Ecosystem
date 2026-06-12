// Per-deck markdown notes. Plain string in localStorage; rendered by a tiny
// inline markdown formatter (no external deps). Auto-saved on change.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "notes:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadNotes(deckId: string): string {
  return readJSON<string>(key(deckId), "");
}

export function saveNotes(deckId: string, text: string): void {
  writeJSON(key(deckId), text);
  notifyStorageChange();
}
