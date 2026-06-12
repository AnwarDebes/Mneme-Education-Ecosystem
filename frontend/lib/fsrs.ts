// Minimal FSRS-v5-flavored scheduler. The full algorithm uses 19 parameters
// learned per user; we ship Anki's published defaults. We compute stability,
// difficulty, retrievability and use them to set the next interval at a
// target retention of 0.9.
//
// Reference: https://github.com/open-spaced-repetition/fsrs4anki

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export type Rating = 1 | 2 | 3 | 4; // again / hard / good / easy

const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544,
  1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567,
];

const REQUEST_RETENTION = 0.9;
const FACTOR = Math.pow(REQUEST_RETENTION, -1 / -0.5) - 1;

export interface FSRSState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due_at: string;
  last_graded: string | null;
  history: { ts: string; rating: Rating; interval: number; stability: number }[];
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function initStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1);
}

function initDifficulty(rating: Rating): number {
  return clamp(W[4] - (rating - 3) * W[5], 1, 10);
}

function nextDifficulty(d: number, rating: Rating): number {
  const next = d - W[6] * (rating - 3);
  return clamp(W[5] + (1 - W[5]) * next, 1, 10);
}

function nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus);
}

function nextForgetStability(d: number, s: number, r: number): number {
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
}

function retrievability(s: number, elapsedDays: number): number {
  return Math.pow(1 + FACTOR * elapsedDays / s, -0.5);
}

function intervalFromStability(s: number): number {
  return Math.max(1, Math.round(s * FACTOR));
}

function newState(rating: Rating, now: Date): FSRSState {
  const s = initStability(rating);
  const d = initDifficulty(rating);
  const interval = intervalFromStability(s);
  const due = new Date(now);
  due.setDate(due.getDate() + interval);
  return {
    stability: s,
    difficulty: d,
    reps: 1,
    lapses: rating === 1 ? 1 : 0,
    due_at: due.toISOString(),
    last_graded: now.toISOString(),
    history: [{ ts: now.toISOString(), rating, interval, stability: s }],
  };
}

export function applyFSRSGrade(prev: FSRSState | null, rating: Rating, now = new Date()): FSRSState {
  if (!prev) return newState(rating, now);

  const elapsedDays = prev.last_graded
    ? Math.max(0, (now.getTime() - new Date(prev.last_graded).getTime()) / 86400000)
    : 0;
  const r = retrievability(prev.stability, elapsedDays);
  const d2 = nextDifficulty(prev.difficulty, rating);
  const s2 = rating === 1 ? nextForgetStability(prev.difficulty, prev.stability, r) : nextRecallStability(prev.difficulty, prev.stability, r, rating);
  const interval = intervalFromStability(s2);
  const due = new Date(now);
  due.setDate(due.getDate() + interval);
  return {
    stability: s2,
    difficulty: d2,
    reps: rating === 1 ? prev.reps : prev.reps + 1,
    lapses: rating === 1 ? prev.lapses + 1 : prev.lapses,
    due_at: due.toISOString(),
    last_graded: now.toISOString(),
    history: [
      ...prev.history.slice(-49),
      { ts: now.toISOString(), rating, interval, stability: s2 },
    ],
  };
}

const PREFIX = "fsrs:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadFSRS(deckId: string): Record<string, FSRSState> {
  return readJSON<Record<string, FSRSState>>(key(deckId), {});
}

export function getFSRS(deckId: string, cardId: string): FSRSState | null {
  return loadFSRS(deckId)[cardId] ?? null;
}

export function saveFSRS(deckId: string, cardId: string, state: FSRSState): void {
  const all = loadFSRS(deckId);
  all[cardId] = state;
  writeJSON(key(deckId), all);
  notifyStorageChange();
}

export function gradeFSRS(
  deckId: string,
  cardId: string,
  rating: Rating,
): FSRSState {
  const next = applyFSRSGrade(getFSRS(deckId, cardId), rating);
  saveFSRS(deckId, cardId, next);
  return next;
}

export function ratingFromGrade(grade: "again" | "hard" | "good" | "easy"): Rating {
  return grade === "again" ? 1 : grade === "hard" ? 2 : grade === "good" ? 3 : 4;
}
