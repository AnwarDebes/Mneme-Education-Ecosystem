// Personal bests: best day, best week, best accuracy day, etc. Derived
// from existing stats; we cache the snapshots so we can detect new PRs.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate, loadStats, type GlobalStats } from "./stats";

export interface PersonalBests {
  most_reviews_in_day: { date: string | null; count: number };
  most_minutes_in_day: { date: string | null; minutes: number };
  best_accuracy_day: { date: string | null; accuracy: number; total: number };
  longest_streak: number;
}

const KEY = "records:v1";

export function loadBests(): PersonalBests {
  return readJSON<PersonalBests>(KEY, {
    most_reviews_in_day: { date: null, count: 0 },
    most_minutes_in_day: { date: null, minutes: 0 },
    best_accuracy_day: { date: null, accuracy: 0, total: 0 },
    longest_streak: 0,
  });
}

export function computeBests(stats: GlobalStats): PersonalBests {
  const bests = loadBests();
  for (const day of Object.values(stats.daily)) {
    if (day.reviewed > bests.most_reviews_in_day.count) {
      bests.most_reviews_in_day = { date: day.date, count: day.reviewed };
    }
    if (day.minutes > bests.most_minutes_in_day.minutes) {
      bests.most_minutes_in_day = { date: day.date, minutes: day.minutes };
    }
    const correct = day.good + day.easy + day.hard * 0.5;
    const acc = day.reviewed ? correct / day.reviewed : 0;
    if (day.reviewed >= 10 && acc > bests.best_accuracy_day.accuracy) {
      bests.best_accuracy_day = { date: day.date, accuracy: acc, total: day.reviewed };
    }
  }
  if (stats.longest_streak > bests.longest_streak) {
    bests.longest_streak = stats.longest_streak;
  }
  writeJSON(KEY, bests);
  notifyStorageChange();
  return bests;
}

export interface WeeklyDigest {
  start: string;
  end: string;
  total_reviewed: number;
  total_minutes: number;
  active_days: number;
  delta_vs_prev: number;
  accuracy: number;
  top_day: { date: string; reviewed: number };
}

export function buildDigest(stats: GlobalStats): WeeklyDigest {
  const today = new Date();
  const end = isoDate(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);

  let total = 0;
  let minutes = 0;
  let correct = 0;
  let activeDays = 0;
  let prevTotal = 0;
  let top = { date: end, reviewed: 0 };

  for (const day of Object.values(stats.daily)) {
    const date = new Date(day.date + "T00:00:00");
    if (date >= prevStart && date < start) {
      prevTotal += day.reviewed;
    }
    if (date >= start && date <= today) {
      total += day.reviewed;
      minutes += day.minutes;
      correct += day.good + day.easy + day.hard * 0.5;
      if (day.reviewed > 0) activeDays += 1;
      if (day.reviewed > top.reviewed) top = { date: day.date, reviewed: day.reviewed };
    }
  }

  return {
    start: isoDate(start),
    end,
    total_reviewed: total,
    total_minutes: Math.round(minutes),
    active_days: activeDays,
    delta_vs_prev: total - prevTotal,
    accuracy: total > 0 ? correct / total : 0,
    top_day: top,
  };
}
