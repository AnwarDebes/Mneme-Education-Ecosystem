// Per-day session goal: target cards + minutes the user wants to clear.
// Independent of study plans (which are deck-level).

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate, loadStats } from "./stats";

const KEY = "session-goal:v1";

export interface SessionGoal {
  date: string;
  cards: number;
  minutes: number;
}

export interface GoalProgress {
  cards_done: number;
  minutes_done: number;
  cards_pct: number;
  minutes_pct: number;
  cards_remaining: number;
  minutes_remaining: number;
  achieved: boolean;
}

export function loadGoal(): SessionGoal | null {
  const cur = readJSON<SessionGoal | null>(KEY, null);
  if (!cur) return null;
  if (cur.date !== isoDate()) return null;
  return cur;
}

export function saveGoal(cards: number, minutes: number): SessionGoal {
  const goal: SessionGoal = { date: isoDate(), cards, minutes };
  writeJSON(KEY, goal);
  notifyStorageChange();
  return goal;
}

export function clearGoal(): void {
  writeJSON(KEY, null);
  notifyStorageChange();
}

export function goalProgress(goal: SessionGoal): GoalProgress {
  const stats = loadStats();
  const day = stats.daily[goal.date];
  const cardsDone = day?.reviewed ?? 0;
  const minutesDone = day?.minutes ?? 0;
  const cardsPct = goal.cards > 0 ? Math.min(100, Math.round((cardsDone / goal.cards) * 100)) : 100;
  const minutesPct = goal.minutes > 0 ? Math.min(100, Math.round((minutesDone / goal.minutes) * 100)) : 100;
  return {
    cards_done: cardsDone,
    minutes_done: minutesDone,
    cards_pct: cardsPct,
    minutes_pct: minutesPct,
    cards_remaining: Math.max(0, goal.cards - cardsDone),
    minutes_remaining: Math.max(0, goal.minutes - minutesDone),
    achieved: cardsDone >= goal.cards && minutesDone >= goal.minutes,
  };
}
