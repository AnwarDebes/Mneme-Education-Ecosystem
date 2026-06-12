// Global, deck-agnostic study stats: streaks, daily review counts, total
// time studied, achievements unlocked. Everything keyed by ISO date
// ("YYYY-MM-DD") so calendar visualizations are trivial.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { loadVacation } from "./vacation";

export interface DailyEntry {
  date: string;
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  minutes: number;
}

export interface GlobalStats {
  total_reviewed: number;
  total_minutes: number;
  current_streak: number;
  longest_streak: number;
  last_studied: string | null;
  daily: Record<string, DailyEntry>;
  unlocked: string[];
}

const KEY = "stats:global";

export function isoDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function emptyDay(date: string): DailyEntry {
  return { date, reviewed: 0, again: 0, hard: 0, good: 0, easy: 0, minutes: 0 };
}

export function emptyStats(): GlobalStats {
  return {
    total_reviewed: 0,
    total_minutes: 0,
    current_streak: 0,
    longest_streak: 0,
    last_studied: null,
    daily: {},
    unlocked: [],
  };
}

export function loadStats(): GlobalStats {
  return readJSON<GlobalStats>(KEY, emptyStats());
}

export function saveStats(stats: GlobalStats): void {
  writeJSON(KEY, stats);
  notifyStorageChange();
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function recordReview(grade: "again" | "hard" | "good" | "easy"): GlobalStats {
  const stats = loadStats();
  const today = isoDate();
  const day = stats.daily[today] ?? emptyDay(today);
  day.reviewed += 1;
  day[grade] += 1;
  stats.daily[today] = day;
  stats.total_reviewed += 1;

  if (stats.last_studied !== today) {
    const vacationActive = loadVacation().active;
    if (vacationActive) {
      // Keep the streak frozen during vacation; just update last_studied
      // so we don't break the chain when they come back.
      stats.last_studied = today;
    } else {
      if (stats.last_studied && diffDays(stats.last_studied, today) === 1) {
        stats.current_streak = (stats.current_streak || 0) + 1;
      } else {
        stats.current_streak = 1;
      }
      stats.last_studied = today;
      if (stats.current_streak > stats.longest_streak) {
        stats.longest_streak = stats.current_streak;
      }
    }
  }
  saveStats(stats);
  return stats;
}

export function recordSessionMinutes(minutes: number): GlobalStats {
  // Defensive clamp: callers pass `(Date.now() - startedAt) / 60_000`, which
  // can produce negatives if the system clock was rolled back, NaN if a
  // timer fires before mount, or absurdly large values if a Pomodoro is
  // left running across a laptop-sleep boundary. Anything outside a sane
  // single-session range is dropped on the floor.
  if (!Number.isFinite(minutes) || minutes <= 0) return loadStats();
  const safe = Math.min(minutes, 8 * 60); // hard cap at 8 hours per recorded chunk
  const stats = loadStats();
  const today = isoDate();
  const day = stats.daily[today] ?? emptyDay(today);
  day.minutes += safe;
  stats.daily[today] = day;
  stats.total_minutes += safe;
  saveStats(stats);
  return stats;
}

export function unlock(achievement: string): boolean {
  const stats = loadStats();
  if (stats.unlocked.includes(achievement)) return false;
  stats.unlocked.push(achievement);
  saveStats(stats);
  return true;
}

export function lastNDays(stats: GlobalStats, n: number): DailyEntry[] {
  const out: DailyEntry[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    out.push(stats.daily[key] ?? emptyDay(key));
  }
  return out;
}
