// Per-deck chat history. The backend is stateless; this layer is what makes
// "go away and come back later" feel continuous.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import type { ChatMessage } from "./types";

export interface StoredMessage extends ChatMessage {
  id: string;
  ts: string;
}

const PREFIX = "chat:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadChat(deckId: string): StoredMessage[] {
  return readJSON<StoredMessage[]>(key(deckId), []);
}

export function appendChat(deckId: string, msg: ChatMessage): StoredMessage {
  const stored: StoredMessage = {
    ...msg,
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    ts: new Date().toISOString(),
  };
  const cur = loadChat(deckId);
  cur.push(stored);
  writeJSON(key(deckId), cur);
  notifyStorageChange();
  return stored;
}

export function clearChat(deckId: string): void {
  writeJSON(key(deckId), []);
  notifyStorageChange();
}
