// One-level undo for card edits: snapshot the override + media before the
// next save lands so the user can revert that single step. Bigger histories
// invite confusion and stale state; one step covers the common "oops"
// case without retaining versions forever.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import type { CardOverride } from "./deck-store";

export interface CardEditSnapshot {
  override: CardOverride | null;
  media: { image_url?: string; image_caption?: string } | null;
  ts: string;
}

const KEY = "edit-history:v1";

type Store = Record<string, CardEditSnapshot>;

function k(deckId: string, cardId: string): string {
  return `${deckId}::${cardId}`;
}

export function loadEditHistory(deckId: string, cardId: string): CardEditSnapshot | null {
  const all = readJSON<Store>(KEY, {});
  return all[k(deckId, cardId)] ?? null;
}

export function pushEditSnapshot(
  deckId: string,
  cardId: string,
  snapshot: Omit<CardEditSnapshot, "ts">,
): void {
  const all = readJSON<Store>(KEY, {});
  all[k(deckId, cardId)] = { ...snapshot, ts: new Date().toISOString() };
  writeJSON(KEY, all);
  notifyStorageChange();
}

export function clearEditSnapshot(deckId: string, cardId: string): void {
  const all = readJSON<Store>(KEY, {});
  delete all[k(deckId, cardId)];
  writeJSON(KEY, all);
  notifyStorageChange();
}
