// Attach a single audio file (lecture, podcast, recording) to a deck, with
// per-card timestamps. Stored as base64 in localStorage; capped at 4 MB.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface LectureBookmark {
  card_id: string;
  ts_sec: number;
  note?: string;
}

export interface LectureAudio {
  filename: string;
  mime: string;
  data: string; // base64
  duration_sec: number;
  bookmarks: LectureBookmark[];
}

const PREFIX = "lecture:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadLecture(deckId: string): LectureAudio | null {
  return readJSON<LectureAudio | null>(key(deckId), null);
}

export function saveLecture(deckId: string, audio: LectureAudio): void {
  writeJSON(key(deckId), audio);
  notifyStorageChange();
}

export function clearLecture(deckId: string): void {
  writeJSON(key(deckId), null);
  notifyStorageChange();
}

export function addBookmark(deckId: string, bookmark: LectureBookmark): void {
  const cur = loadLecture(deckId);
  if (!cur) return;
  cur.bookmarks = [...cur.bookmarks.filter((b) => b.card_id !== bookmark.card_id), bookmark].sort(
    (a, b) => a.ts_sec - b.ts_sec,
  );
  saveLecture(deckId, cur);
}

export function removeBookmark(deckId: string, cardId: string): void {
  const cur = loadLecture(deckId);
  if (!cur) return;
  cur.bookmarks = cur.bookmarks.filter((b) => b.card_id !== cardId);
  saveLecture(deckId, cur);
}
