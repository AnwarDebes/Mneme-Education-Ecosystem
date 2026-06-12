// Anchor cards: cards the user has pinned as foundational reference.
// In study modes, anchors are inserted at the start of every session and
// every Nth position thereafter to keep them top of mind.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "anchors:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadAnchors(deckId: string): string[] {
  return readJSON<string[]>(key(deckId), []);
}

export function isAnchor(deckId: string, cardId: string): boolean {
  return loadAnchors(deckId).includes(cardId);
}

export function toggleAnchor(deckId: string, cardId: string): boolean {
  const cur = loadAnchors(deckId);
  let next: string[];
  if (cur.includes(cardId)) next = cur.filter((id) => id !== cardId);
  else next = [...cur, cardId];
  writeJSON(key(deckId), next);
  notifyStorageChange();
  return next.includes(cardId);
}
