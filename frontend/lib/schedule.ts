// FSRS-lite: a tiny implementation of SM-2-style spaced repetition that
// runs entirely in the browser. We store per-card review history and a
// next-due timestamp, then sort decks by due-first.
//
// We're not trying to match the full FSRS-5 algorithm here. Anki/FSRS
// running over the exported .apkg is the canonical scheduler. This is
// just enough to drive an in-browser study queue.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export type Grade = "again" | "hard" | "good" | "easy";

export interface CardReview {
  graded_at: string;
  grade: Grade;
  interval_days: number;
  ease: number;
}

export interface CardSchedule {
  reps: number;
  lapses: number;
  ease: number;
  interval_days: number;
  due_at: string;
  last_graded: string | null;
  history: CardReview[];
}

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

const GRADE_EASE_DELTA: Record<Grade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

const GRADE_INTERVAL_MULT: Record<Grade, number> = {
  again: 0,
  hard: 1.2,
  good: 2.5,
  easy: 4.0,
};

function key(deckId: string): string {
  return `schedule:${deckId}`;
}

function emptyCardSchedule(): CardSchedule {
  return {
    reps: 0,
    lapses: 0,
    ease: DEFAULT_EASE,
    interval_days: 0,
    due_at: new Date().toISOString(),
    last_graded: null,
    history: [],
  };
}

export function loadDeckSchedule(deckId: string): Record<string, CardSchedule> {
  return readJSON<Record<string, CardSchedule>>(key(deckId), {});
}

export function saveDeckSchedule(
  deckId: string,
  schedule: Record<string, CardSchedule>,
): void {
  writeJSON(key(deckId), schedule);
  notifyStorageChange();
}

export function getCardSchedule(deckId: string, cardId: string): CardSchedule {
  const all = loadDeckSchedule(deckId);
  return all[cardId] ?? emptyCardSchedule();
}

// Run FSRS in parallel so the new scheduler accumulates state alongside the
// SM-2-lite one; consumers can opt in via the FSRS APIs.
function _sideRunFSRS(deckId: string, cardId: string, grade: Grade): void {
  try {
    // Lazy require to avoid a hard import cycle.
    const fsrs = require("./fsrs") as typeof import("./fsrs");
    fsrs.gradeFSRS(deckId, cardId, fsrs.ratingFromGrade(grade));
  } catch {
    /* ignore */
  }
}

export function gradeCard(
  deckId: string,
  cardId: string,
  grade: Grade,
): CardSchedule {
  // Run FSRS first: it returns the canonical interval + due date.
  let fsrsInterval: number | null = null;
  let fsrsDueAt: string | null = null;
  try {
    const fsrs = require("./fsrs") as typeof import("./fsrs");
    const state = fsrs.gradeFSRS(deckId, cardId, fsrs.ratingFromGrade(grade));
    fsrsInterval = Math.max(grade === "again" ? 0 : 1, Math.round(state.history.at(-1)?.interval ?? 1));
    fsrsDueAt = state.due_at;
  } catch {
    /* fall back to SM-2-lite */
  }
  const all = loadDeckSchedule(deckId);
  const current = all[cardId] ?? emptyCardSchedule();
  const easeNext = Math.max(MIN_EASE, current.ease + GRADE_EASE_DELTA[grade]);

  let intervalNext: number;
  if (fsrsInterval != null) {
    intervalNext = fsrsInterval;
  } else if (grade === "again") {
    intervalNext = 0;
  } else if (current.reps === 0) {
    intervalNext = grade === "easy" ? 4 : grade === "hard" ? 1 : 2;
  } else {
    const baseline = Math.max(current.interval_days, 1);
    intervalNext = Math.max(
      1,
      Math.round(baseline * easeNext * (GRADE_INTERVAL_MULT[grade] / 2.5)),
    );
  }

  const now = new Date();
  const due = fsrsDueAt ? new Date(fsrsDueAt) : (() => { const d = new Date(now); d.setDate(d.getDate() + intervalNext); return d; })();

  const updated: CardSchedule = {
    reps: grade === "again" ? current.reps : current.reps + 1,
    lapses: grade === "again" ? current.lapses + 1 : current.lapses,
    ease: easeNext,
    interval_days: intervalNext,
    due_at: due.toISOString(),
    last_graded: now.toISOString(),
    history: [
      ...current.history.slice(-49),
      {
        graded_at: now.toISOString(),
        grade,
        interval_days: intervalNext,
        ease: easeNext,
      },
    ],
  };

  all[cardId] = updated;
  saveDeckSchedule(deckId, all);
  return updated;
}

// Schedule writes invalidate the result caches. Keyed by deckId; we
// intentionally don't key by allCardIds because the input is supplied by
// the caller and would push the cache to N entries per deck. The minute-
// level bucket on Date.now() keeps results fresh enough for due/now while
// avoiding cache thrash on every clock tick.
const DUE_CACHE = new Map<string, { v: number; ids: string[]; bucket: number; result: string[] }>();
const STATS_CACHE = new Map<string, { v: number; ids: string[]; bucket: number; result: ReturnType<typeof computeDeckStats> }>();

function timeBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

let scheduleVersion = 0;
if (typeof window !== "undefined") {
  // Bump on any schedule-namespace write or cross-tab change.
  // (storage.ts dispatches storage events on cross-tab writes.)
  const bump = () => {
    scheduleVersion += 1;
  };
  window.addEventListener("mneme:storage", (e: Event) => {
    const detail = (e as CustomEvent<{ ns?: string }>).detail;
    if (!detail?.ns || detail.ns === "schedule" || detail.ns === "fsrs" || detail.ns === "other") bump();
  });
  window.addEventListener("storage", bump);
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function dueCardIds(deckId: string, allCardIds: string[]): string[] {
  const bucket = timeBucket();
  const cached = DUE_CACHE.get(deckId);
  if (cached && cached.v === scheduleVersion && cached.bucket === bucket && sameIds(cached.ids, allCardIds)) {
    return cached.result;
  }
  const sched = loadDeckSchedule(deckId);
  const now = Date.now();
  const result = allCardIds.filter((id) => {
    const s = sched[id];
    if (!s) return true; // never seen → due
    return new Date(s.due_at).getTime() <= now;
  });
  DUE_CACHE.set(deckId, { v: scheduleVersion, ids: allCardIds.slice(), bucket, result });
  return result;
}

function computeDeckStats(deckId: string, allCardIds: string[]) {
  const sched = loadDeckSchedule(deckId);
  const now = Date.now();
  let due = 0;
  let learned = 0;
  let mastered = 0;
  let lapses = 0;
  let easeSum = 0;
  let easeCount = 0;
  for (const id of allCardIds) {
    const s = sched[id];
    if (!s) {
      due += 1;
      continue;
    }
    if (s.reps > 0) learned += 1;
    if (s.reps >= 4 && s.lapses === 0) mastered += 1;
    if (new Date(s.due_at).getTime() <= now) due += 1;
    lapses += s.lapses;
    easeSum += s.ease;
    easeCount += 1;
  }
  return {
    due_now: due,
    learned,
    mastered,
    lapses,
    avg_ease: easeCount === 0 ? DEFAULT_EASE : easeSum / easeCount,
  };
}

export function deckScheduleStats(
  deckId: string,
  allCardIds: string[],
): {
  due_now: number;
  learned: number;
  mastered: number;
  lapses: number;
  avg_ease: number;
} {
  const bucket = timeBucket();
  const cached = STATS_CACHE.get(deckId);
  if (cached && cached.v === scheduleVersion && cached.bucket === bucket && sameIds(cached.ids, allCardIds)) {
    return cached.result;
  }
  const result = computeDeckStats(deckId, allCardIds);
  STATS_CACHE.set(deckId, { v: scheduleVersion, ids: allCardIds.slice(), bucket, result });
  return result;
}
