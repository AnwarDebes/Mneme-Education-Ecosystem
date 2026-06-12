// Per-card hints stored in localStorage and applied transparently in any
// study mode. Each card can have N progressive hints; the user reveals
// them one at a time during a session.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const KEY_PREFIX = "hints:";

export interface HintsForCard {
  hints: string[];
}

function key(deckId: string): string {
  return KEY_PREFIX + deckId;
}

export function loadHints(deckId: string): Record<string, HintsForCard> {
  return readJSON<Record<string, HintsForCard>>(key(deckId), {});
}

export function saveHints(deckId: string, all: Record<string, HintsForCard>): void {
  writeJSON(key(deckId), all);
  notifyStorageChange();
}

export function getCardHints(deckId: string, cardId: string): string[] {
  return loadHints(deckId)[cardId]?.hints ?? [];
}

export function setCardHints(deckId: string, cardId: string, hints: string[]): void {
  const all = loadHints(deckId);
  if (hints.length === 0) delete all[cardId];
  else all[cardId] = { hints };
  saveHints(deckId, all);
}

// Heuristic fallback: if a card has no manual hints, derive a single
// "first letter / shape" hint from the answer.
export function autoHint(answer: string): string {
  const trimmed = (answer || "").trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= 2) {
    return tokens.map((t) => t[0] + "_".repeat(Math.max(1, t.length - 1))).join(" ");
  }
  return `${tokens.length} words, starts with "${tokens[0][0]}"`;
}
