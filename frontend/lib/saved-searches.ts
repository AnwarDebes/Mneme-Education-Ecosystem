// Named search filters the user can recall in the global search page.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  deck_id: string | null;
  tag: string | null;
  created_at: string;
}

const KEY = "saved-searches:v1";

export function loadSavedSearches(): SavedSearch[] {
  return readJSON<SavedSearch[]>(KEY, []);
}

export function saveSearch(s: Omit<SavedSearch, "id" | "created_at">): SavedSearch {
  const cur = loadSavedSearches();
  const out: SavedSearch = {
    ...s,
    id: `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    created_at: new Date().toISOString(),
  };
  cur.push(out);
  writeJSON(KEY, cur);
  notifyStorageChange();
  return out;
}

export function deleteSavedSearch(id: string): void {
  const cur = loadSavedSearches().filter((s) => s.id !== id);
  writeJSON(KEY, cur);
  notifyStorageChange();
}
