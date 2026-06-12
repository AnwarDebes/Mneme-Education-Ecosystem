// Persistent text highlights inside the source viewer. Each highlight is a
// span (start, end) in the source string + a color label.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export type HighlightColor = "yellow" | "pink" | "green" | "blue";

export interface Highlight {
  id: string;
  start: number;
  end: number;
  text: string;
  color: HighlightColor;
  created_at: string;
}

const PREFIX = "highlights:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadHighlights(deckId: string): Highlight[] {
  return readJSON<Highlight[]>(key(deckId), []);
}

export function addHighlight(
  deckId: string,
  start: number,
  end: number,
  text: string,
  color: HighlightColor = "yellow",
): Highlight {
  const list = loadHighlights(deckId);
  const h: Highlight = {
    id: `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    start,
    end,
    text,
    color,
    created_at: new Date().toISOString(),
  };
  list.push(h);
  writeJSON(key(deckId), list);
  notifyStorageChange();
  return h;
}

export function removeHighlight(deckId: string, id: string): void {
  const list = loadHighlights(deckId).filter((h) => h.id !== id);
  writeJSON(key(deckId), list);
  notifyStorageChange();
}

export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: "bg-amber-200/60 dark:bg-amber-500/30",
  pink: "bg-rose-200/60 dark:bg-rose-500/30",
  green: "bg-emerald-200/60 dark:bg-emerald-500/30",
  blue: "bg-sky-200/60 dark:bg-sky-500/30",
};
