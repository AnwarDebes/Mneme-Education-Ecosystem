// Per-card 0-5 star ratings stored in localStorage. Independent of the
// FSRS schedule so users can pin "this card is great" or "this is broken"
// without affecting the spaced-repetition signal.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "rating:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadRatings(deckId: string): Record<string, number> {
  return readJSON<Record<string, number>>(key(deckId), {});
}

export function setCardRating(deckId: string, cardId: string, stars: number): void {
  const all = loadRatings(deckId);
  if (stars <= 0) delete all[cardId];
  else all[cardId] = Math.max(1, Math.min(5, Math.round(stars)));
  writeJSON(key(deckId), all);
  notifyStorageChange();
}

export function getCardRating(deckId: string, cardId: string): number {
  return loadRatings(deckId)[cardId] ?? 0;
}
