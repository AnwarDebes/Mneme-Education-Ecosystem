// Per-deck overlay: lets the user edit cards, favorite them, add personal
// notes, archive entire decks, and override deck names, all without ever
// touching the backend. The backend remains the source of truth for the
// generated cards; this overlay layers user intent on top.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface CardOverride {
  question?: string;
  answer?: string;
  notes?: string;
  favorite?: boolean;
  archived?: boolean;
  customTags?: string[];
  difficultyOverride?: "easy" | "medium" | "hard";
}

export interface DeckMeta {
  alias?: string;
  archived?: boolean;
  starred?: boolean;
  description?: string;
  color?: string;
  lastStudied?: string;
  cards: Record<string, CardOverride>;
}

export function emptyMeta(): DeckMeta {
  return { cards: {} };
}

function key(deckId: string): string {
  return `deck:${deckId}`;
}

export function loadDeckMeta(deckId: string): DeckMeta {
  return readJSON<DeckMeta>(key(deckId), emptyMeta());
}

export function saveDeckMeta(deckId: string, meta: DeckMeta): void {
  writeJSON(key(deckId), meta);
  notifyStorageChange();
}

export function updateCardOverride(
  deckId: string,
  cardId: string,
  patch: Partial<CardOverride>,
): void {
  const meta = loadDeckMeta(deckId);
  const existing = meta.cards[cardId] ?? {};
  meta.cards[cardId] = { ...existing, ...patch };
  saveDeckMeta(deckId, meta);
}

export function clearCardOverride(deckId: string, cardId: string): void {
  const meta = loadDeckMeta(deckId);
  delete meta.cards[cardId];
  saveDeckMeta(deckId, meta);
}

export function toggleCardFavorite(deckId: string, cardId: string): boolean {
  const meta = loadDeckMeta(deckId);
  const current = !!meta.cards[cardId]?.favorite;
  meta.cards[cardId] = { ...(meta.cards[cardId] ?? {}), favorite: !current };
  saveDeckMeta(deckId, meta);
  return !current;
}

export function toggleCardArchived(deckId: string, cardId: string): boolean {
  const meta = loadDeckMeta(deckId);
  const current = !!meta.cards[cardId]?.archived;
  meta.cards[cardId] = { ...(meta.cards[cardId] ?? {}), archived: !current };
  saveDeckMeta(deckId, meta);
  return !current;
}

export function setDeckAlias(deckId: string, alias: string): void {
  const meta = loadDeckMeta(deckId);
  meta.alias = alias.trim() || undefined;
  saveDeckMeta(deckId, meta);
}

export function toggleDeckStar(deckId: string): boolean {
  const meta = loadDeckMeta(deckId);
  meta.starred = !meta.starred;
  saveDeckMeta(deckId, meta);
  return !!meta.starred;
}

export function toggleDeckArchived(deckId: string): boolean {
  const meta = loadDeckMeta(deckId);
  meta.archived = !meta.archived;
  saveDeckMeta(deckId, meta);
  return !!meta.archived;
}

export function setDeckColor(deckId: string, color: string): void {
  const meta = loadDeckMeta(deckId);
  meta.color = color;
  saveDeckMeta(deckId, meta);
}

export function setDeckLastStudied(deckId: string): void {
  const meta = loadDeckMeta(deckId);
  meta.lastStudied = new Date().toISOString();
  saveDeckMeta(deckId, meta);
}
