// Custom keyboard shortcuts: the user can rebind any action ID to a key.
// Defaults match the hardcoded ones used in flip-mode and elsewhere.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface ShortcutAction {
  id: string;
  label: string;
  category: string;
}

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: "flip", label: "Flip card", category: "Study" },
  { id: "grade-again", label: "Grade: again", category: "Study" },
  { id: "grade-hard", label: "Grade: hard", category: "Study" },
  { id: "grade-good", label: "Grade: good", category: "Study" },
  { id: "grade-easy", label: "Grade: easy", category: "Study" },
  { id: "favorite", label: "Favorite current card", category: "Study" },
  { id: "edit", label: "Edit current card", category: "Study" },
  { id: "next", label: "Next card", category: "Study" },
  { id: "prev", label: "Previous card", category: "Study" },
  { id: "palette", label: "Open command palette", category: "Global" },
];

const KEY = "shortcuts:v1";

const DEFAULTS: Record<string, string> = {
  flip: "Space",
  "grade-again": "1",
  "grade-hard": "2",
  "grade-good": "3",
  "grade-easy": "4",
  favorite: "f",
  edit: "e",
  next: "ArrowRight",
  prev: "ArrowLeft",
  palette: "Meta+k",
};

export function loadShortcuts(): Record<string, string> {
  return { ...DEFAULTS, ...readJSON<Record<string, string>>(KEY, {}) };
}

export function setShortcut(actionId: string, combo: string): void {
  const cur = readJSON<Record<string, string>>(KEY, {});
  if (combo) cur[actionId] = combo;
  else delete cur[actionId];
  writeJSON(KEY, cur);
  notifyStorageChange();
}

export function resetShortcuts(): void {
  writeJSON(KEY, {});
  notifyStorageChange();
}

export function matchesShortcut(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.split("+").map((p) => p.trim());
  const key = parts[parts.length - 1];
  const wantMeta = parts.includes("Meta") || parts.includes("Cmd");
  const wantCtrl = parts.includes("Ctrl");
  const wantShift = parts.includes("Shift");
  const wantAlt = parts.includes("Alt");
  if (wantMeta && !e.metaKey && !e.ctrlKey) return false;
  if (wantCtrl && !e.ctrlKey) return false;
  if (wantShift && !e.shiftKey) return false;
  if (wantAlt && !e.altKey) return false;
  if (e.key === key || e.key === key.toLowerCase() || e.key === key.toUpperCase()) return true;
  return false;
}

export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey && !e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(e.key === " " ? "Space" : e.key);
  return parts.join("+");
}
