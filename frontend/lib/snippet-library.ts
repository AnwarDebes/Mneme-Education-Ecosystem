// Reusable user-defined snippets, e.g. a common card opener or a
// frequently-typed formula. Loaded into the Add Card / Edit dialogs.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface Snippet {
  id: string;
  name: string;
  text: string;
  hotkey?: string;
}

const KEY = "snippets:v1";

export function loadSnippets(): Snippet[] {
  return readJSON<Snippet[]>(KEY, []);
}

export function addSnippet(name: string, text: string, hotkey?: string): Snippet {
  const cur = loadSnippets();
  const s: Snippet = {
    id: `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim() || "Snippet",
    text,
    hotkey,
  };
  cur.push(s);
  writeJSON(KEY, cur);
  notifyStorageChange();
  return s;
}

export function deleteSnippet(id: string): void {
  writeJSON(KEY, loadSnippets().filter((s) => s.id !== id));
  notifyStorageChange();
}
