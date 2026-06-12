// Card chains: ordered sequences of cards within a deck. Useful for
// processes ("step 1 -> step 2 -> step 3") that should always be reviewed
// in order. Stored as named lists of card ids per deck.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "chains:";

export interface CardChain {
  id: string;
  name: string;
  card_ids: string[];
  created_at: string;
}

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadChains(deckId: string): CardChain[] {
  return readJSON<CardChain[]>(key(deckId), []);
}

export function saveChain(deckId: string, name: string, cardIds: string[]): CardChain {
  const list = loadChains(deckId);
  const c: CardChain = {
    id: `chain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim() || "Chain",
    card_ids: cardIds,
    created_at: new Date().toISOString(),
  };
  list.push(c);
  writeJSON(key(deckId), list);
  notifyStorageChange();
  return c;
}

export function deleteChain(deckId: string, id: string): void {
  const list = loadChains(deckId).filter((c) => c.id !== id);
  writeJSON(key(deckId), list);
  notifyStorageChange();
}

export function updateChain(deckId: string, id: string, patch: Partial<CardChain>): void {
  const list = loadChains(deckId);
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  writeJSON(key(deckId), list);
  notifyStorageChange();
}
