// Track reading-session time per deck. Independent of the study minutes
// tracker so we can show "20 min reading, 35 min recall" splits.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate } from "./stats";

const PREFIX = "reading:";

export interface ReadingDay {
  date: string;
  minutes: number;
}

export interface DeckReading {
  days: Record<string, ReadingDay>;
  total_minutes: number;
}

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadReading(deckId: string): DeckReading {
  return readJSON<DeckReading>(key(deckId), { days: {}, total_minutes: 0 });
}

export function recordReadingMinutes(deckId: string, minutes: number): void {
  if (minutes <= 0) return;
  const cur = loadReading(deckId);
  const today = isoDate();
  const day = cur.days[today] ?? { date: today, minutes: 0 };
  day.minutes += minutes;
  cur.days[today] = day;
  cur.total_minutes += minutes;
  writeJSON(key(deckId), cur);
  notifyStorageChange();
}
