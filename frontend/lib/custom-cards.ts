// User-authored cards that we layer on top of the generated deck. They live
// purely in localStorage and never round-trip to the backend, so they don't
// affect the .apkg the backend exports. (We'll export them in the client CSV
// / JSON exporters though.)

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import type { Card as CardData } from "./types";

const KEY_PREFIX = "custom-cards:";

function key(deckId: string): string {
  return KEY_PREFIX + deckId;
}

export function loadCustomCards(deckId: string): CardData[] {
  return readJSON<CardData[]>(key(deckId), []);
}

export function saveCustomCards(deckId: string, cards: CardData[]): void {
  writeJSON(key(deckId), cards);
  notifyStorageChange();
}

export function addCustomCard(
  deckId: string,
  payload: { question: string; answer: string; tags?: string[]; difficulty?: "easy" | "medium" | "hard" | null },
): CardData {
  const card: CardData = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    question: payload.question.trim(),
    answer: payload.answer.trim(),
    tags: payload.tags ?? ["custom"],
    difficulty: payload.difficulty ?? null,
    difficulty_rationale: "User-authored card.",
    quality_score: null,
    source_fact: null,
  };
  const cards = loadCustomCards(deckId);
  cards.push(card);
  saveCustomCards(deckId, cards);
  return card;
}

export function deleteCustomCard(deckId: string, cardId: string): void {
  const cards = loadCustomCards(deckId).filter((c) => c.id !== cardId);
  saveCustomCards(deckId, cards);
}
