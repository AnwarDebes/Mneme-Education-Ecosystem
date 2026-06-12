// Deck snapshots: point-in-time copies of a deck's local overlay state
// (card edits, schedule, ratings, notes, hints, anchors, custom cards).
// Lets the user roll back after a bad bulk edit or experimental session.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const PREFIX = "snapshot:";
const INDEX_KEY = "snapshots:index";

export interface SnapshotMeta {
  id: string;
  deck_id: string;
  name: string;
  created_at: string;
  cards_count: number;
}

export interface SnapshotBlob {
  meta: SnapshotMeta;
  // Maps localStorage key (e.g. "mneme:deck:<id>") to the JSON value at
  // capture time.
  entries: Record<string, unknown>;
}

const SNAPSHOTTED_PREFIXES = [
  "deck:",
  "schedule:",
  "rating:",
  "anchors:",
  "hints:",
  "notes:",
  "media:",
  "rel:",
  "chains:",
  "variants:",
  "custom-cards:",
  "highlights:",
];

function indexKey(deckId: string): string {
  return INDEX_KEY + ":" + deckId;
}

export function listSnapshots(deckId: string): SnapshotMeta[] {
  return readJSON<SnapshotMeta[]>(indexKey(deckId), []);
}

export function takeSnapshot(deckId: string, name: string, cardsCount: number): SnapshotMeta {
  if (typeof window === "undefined") {
    throw new Error("snapshots require a browser");
  }
  const id = `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const entries: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith("mneme:")) continue;
    const bare = k.slice("mneme:".length);
    const matches = SNAPSHOTTED_PREFIXES.some((p) => bare === `${p.replace(/:$/, "")}:${deckId}` || bare === `${p}${deckId}`);
    if (!matches) continue;
    try {
      entries[k] = JSON.parse(window.localStorage.getItem(k) || "null");
    } catch {
      /* skip */
    }
  }
  const meta: SnapshotMeta = {
    id,
    deck_id: deckId,
    name: name.trim() || `Snapshot ${new Date().toLocaleString()}`,
    created_at: new Date().toISOString(),
    cards_count: cardsCount,
  };
  writeJSON(PREFIX + id, { meta, entries });
  const idx = listSnapshots(deckId);
  idx.unshift(meta);
  writeJSON(indexKey(deckId), idx.slice(0, 20));
  notifyStorageChange();
  return meta;
}

export function restoreSnapshot(id: string): boolean {
  if (typeof window === "undefined") return false;
  const blob = readJSON<SnapshotBlob | null>(PREFIX + id, null);
  if (!blob) return false;
  // Wipe the keys covered by the snapshot for this deck, then re-write.
  const deckId = blob.meta.deck_id;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith("mneme:")) continue;
    const bare = k.slice("mneme:".length);
    const matches = SNAPSHOTTED_PREFIXES.some((p) => bare === `${p.replace(/:$/, "")}:${deckId}` || bare === `${p}${deckId}`);
    if (!matches) continue;
    window.localStorage.removeItem(k);
  }
  for (const [k, v] of Object.entries(blob.entries)) {
    window.localStorage.setItem(k, JSON.stringify(v));
  }
  try {
    window.dispatchEvent(new Event("mneme:storage"));
  } catch {
    /* ignore */
  }
  return true;
}

export function deleteSnapshot(deckId: string, id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("mneme:" + PREFIX + id);
  const idx = listSnapshots(deckId).filter((m) => m.id !== id);
  writeJSON(indexKey(deckId), idx);
  notifyStorageChange();
}
