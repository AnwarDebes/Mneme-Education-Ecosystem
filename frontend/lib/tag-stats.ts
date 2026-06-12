// Per-tag grade tally. Updated on every review across every deck, so we can
// surface "this user struggles with photosynthesis" insights regardless of
// which deck the grades came from.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface TagBucket {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export function emptyBucket(): TagBucket {
  return { again: 0, hard: 0, good: 0, easy: 0 };
}

const KEY = "tag-stats:global";

export function loadTagStats(): Record<string, TagBucket> {
  return readJSON<Record<string, TagBucket>>(KEY, {});
}

export function saveTagStats(stats: Record<string, TagBucket>): void {
  writeJSON(KEY, stats);
  notifyStorageChange();
}

export function recordTagGrade(tags: string[], grade: "again" | "hard" | "good" | "easy"): void {
  const stats = loadTagStats();
  for (const t of tags) {
    if (!t) continue;
    const cur = stats[t] ?? emptyBucket();
    cur[grade] = (cur[grade] ?? 0) + 1;
    stats[t] = cur;
  }
  saveTagStats(stats);
}

export function tagAccuracy(b: TagBucket): { total: number; correct: number; pct: number } {
  const total = b.again + b.hard + b.good + b.easy;
  const correct = b.good + b.easy + b.hard * 0.5;
  return { total, correct, pct: total ? correct / total : 0 };
}
