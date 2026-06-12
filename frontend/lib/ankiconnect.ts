"use client";
// Thin client for the AnkiConnect plugin (https://foosoft.net/projects/anki-connect/).
// Talks directly to the user's running Anki desktop instance from the
// browser - no backend touch. Persists the AnkiConnect URL in settings.

import { readJSON, writeJSON, notifyStorageChange } from "./storage";
import type { ResolvedCard } from "./cards";

const URL_KEY = "settings:anki-connect-url";
const DEFAULT_URL = "http://127.0.0.1:8765";

export function loadAnkiConnectUrl(): string {
  return readJSON<string>(URL_KEY, DEFAULT_URL);
}

export function saveAnkiConnectUrl(url: string): void {
  writeJSON(URL_KEY, url.trim() || DEFAULT_URL);
  notifyStorageChange();
}

async function call<T>(action: string, params: Record<string, unknown> = {}, url?: string): Promise<T> {
  const endpoint = url || loadAnkiConnectUrl();
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!resp.ok) throw new Error(`AnkiConnect HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.result as T;
}

export async function pingAnki(url?: string): Promise<{ version: number }> {
  const v = await call<number>("version", {}, url);
  return { version: v };
}

export async function listDecks(): Promise<string[]> {
  return call<string[]>("deckNames");
}

export async function createDeck(name: string): Promise<number> {
  return call<number>("createDeck", { deck: name });
}

export interface PushResult {
  added: number;
  duplicates: number;
  errors: string[];
}

export async function pushDeck(
  deckName: string,
  cards: ResolvedCard[],
): Promise<PushResult> {
  await createDeck(deckName);
  // Build addNotes payload.
  const notes = cards.map((c) => ({
    deckName,
    modelName: "Basic",
    fields: { Front: c.question, Back: c.answer },
    options: { allowDuplicate: false },
    tags: [...c.tags, ...c.customTags, "mneme"],
  }));
  const result = await call<(number | null)[]>("addNotes", { notes });
  let added = 0;
  let duplicates = 0;
  const errors: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const r = result[i];
    if (r == null) {
      duplicates += 1;
    } else if (typeof r === "number") {
      added += 1;
    } else {
      errors.push(`card ${i + 1}: unknown response`);
    }
  }
  return { added, duplicates, errors };
}
