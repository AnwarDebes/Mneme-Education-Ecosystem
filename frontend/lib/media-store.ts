// Per-card rich media overlay: image URLs, voice memos, sketch SVGs.
// Lives in localStorage and applies on top of the backend's plain text card.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface CardMedia {
  image_url?: string;
  image_caption?: string;
  audio_data?: string;
  audio_mime?: string;
  drawing_svg?: string;
}

const PREFIX = "media:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadMedia(deckId: string): Record<string, CardMedia> {
  return readJSON<Record<string, CardMedia>>(key(deckId), {});
}

export function saveMedia(deckId: string, value: Record<string, CardMedia>): void {
  writeJSON(key(deckId), value);
  notifyStorageChange();
}

export function getCardMedia(deckId: string, cardId: string): CardMedia {
  return loadMedia(deckId)[cardId] ?? {};
}

export function updateCardMedia(
  deckId: string,
  cardId: string,
  patch: Partial<CardMedia>,
): void {
  const all = loadMedia(deckId);
  const cur = all[cardId] ?? {};
  const next = { ...cur, ...patch };
  // Drop empty keys so we don't bloat storage with undefined slots.
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === "") delete (next as Record<string, unknown>)[k];
  }
  if (Object.keys(next).length === 0) delete all[cardId];
  else all[cardId] = next;
  saveMedia(deckId, all);
}

export function clearCardMedia(deckId: string, cardId: string): void {
  const all = loadMedia(deckId);
  delete all[cardId];
  saveMedia(deckId, all);
}
