// Collections (a.k.a. folders / courses): a way to group decks together.
// Each deck can belong to zero or more collections; the source of truth is
// the membership map, so renaming or deleting a deck doesn't break a
// collection. Stored entirely in localStorage.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  deck_ids: string[];
}

const KEY = "collections:v1";

const PALETTE = [
  "from-violet-500/25 to-indigo-400/15",
  "from-emerald-500/25 to-teal-400/15",
  "from-amber-500/25 to-orange-400/15",
  "from-rose-500/25 to-pink-400/15",
  "from-sky-500/25 to-cyan-400/15",
  "from-fuchsia-500/25 to-purple-400/15",
];

function newId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadCollections(): Collection[] {
  return readJSON<Collection[]>(KEY, []);
}

export function saveCollections(items: Collection[]): void {
  writeJSON(KEY, items);
  notifyStorageChange();
}

export function createCollection(name: string, description?: string): Collection {
  const items = loadCollections();
  const c: Collection = {
    id: newId(),
    name: name.trim() || "Untitled",
    description,
    color: PALETTE[items.length % PALETTE.length],
    created_at: new Date().toISOString(),
    deck_ids: [],
  };
  items.push(c);
  saveCollections(items);
  return c;
}

export function renameCollection(id: string, name: string): void {
  const items = loadCollections();
  const c = items.find((x) => x.id === id);
  if (!c) return;
  c.name = name.trim() || c.name;
  saveCollections(items);
}

export function deleteCollection(id: string): void {
  saveCollections(loadCollections().filter((c) => c.id !== id));
}

export function addDeckToCollection(collectionId: string, deckId: string): void {
  const items = loadCollections();
  const c = items.find((x) => x.id === collectionId);
  if (!c) return;
  if (!c.deck_ids.includes(deckId)) c.deck_ids.push(deckId);
  saveCollections(items);
}

export function removeDeckFromCollection(collectionId: string, deckId: string): void {
  const items = loadCollections();
  const c = items.find((x) => x.id === collectionId);
  if (!c) return;
  c.deck_ids = c.deck_ids.filter((id) => id !== deckId);
  saveCollections(items);
}

export function deckCollections(deckId: string): Collection[] {
  return loadCollections().filter((c) => c.deck_ids.includes(deckId));
}
