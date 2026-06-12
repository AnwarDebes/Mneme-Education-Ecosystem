// Multiple Q-phrasings for the same A, stored per-deck per-card. Lets you
// drill the same fact under different question wordings (recognition
// vs paraphrase vs definition vs application).

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "variants:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export interface CardVariants {
  [cardId: string]: string[];
}

export function loadVariants(deckId: string): CardVariants {
  return readJSON<CardVariants>(key(deckId), {});
}

export function getVariants(deckId: string, cardId: string): string[] {
  return loadVariants(deckId)[cardId] ?? [];
}

export function addVariant(deckId: string, cardId: string, phrasing: string): void {
  const phr = phrasing.trim();
  if (!phr) return;
  const all = loadVariants(deckId);
  const list = all[cardId] ?? [];
  if (!list.includes(phr)) list.push(phr);
  all[cardId] = list;
  writeJSON(key(deckId), all);
  notifyStorageChange();
}

export function removeVariant(deckId: string, cardId: string, phrasing: string): void {
  const all = loadVariants(deckId);
  const list = (all[cardId] ?? []).filter((v) => v !== phrasing);
  if (list.length === 0) delete all[cardId];
  else all[cardId] = list;
  writeJSON(key(deckId), all);
  notifyStorageChange();
}

export function pickVariantQuestion(deckId: string, cardId: string, defaultQuestion: string): string {
  const list = getVariants(deckId, cardId);
  if (list.length === 0) return defaultQuestion;
  // Cycle deterministically by review count of the card so back-to-back
  // sessions hit different phrasings.
  const choices = [defaultQuestion, ...list];
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}
