// Daily study journal: per-day reflection text + mood + key takeaway.
// Lives in localStorage, keyed by ISO date.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate } from "./stats";

export type Mood = "great" | "good" | "okay" | "tired" | "off";

export interface JournalEntry {
  date: string;
  mood: Mood;
  reflection: string;
  takeaway: string;
  updated_at: string;
}

const KEY = "journal:v1";

export function loadJournal(): Record<string, JournalEntry> {
  return readJSON<Record<string, JournalEntry>>(KEY, {});
}

export function loadJournalEntry(date = isoDate()): JournalEntry | null {
  return loadJournal()[date] ?? null;
}

export function saveJournalEntry(entry: Omit<JournalEntry, "updated_at">): JournalEntry {
  const all = loadJournal();
  const next: JournalEntry = { ...entry, updated_at: new Date().toISOString() };
  all[entry.date] = next;
  writeJSON(KEY, all);
  notifyStorageChange();
  return next;
}

export function listJournalDates(limit = 30): string[] {
  return Object.keys(loadJournal()).sort().reverse().slice(0, limit);
}

export const MOOD_EMOJI: Record<Mood, string> = {
  great: "🤩",
  good: "🙂",
  okay: "😐",
  tired: "😴",
  off: "😬",
};
