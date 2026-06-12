// XP + levels. Earn:
//   1 XP per card reviewed
//   +1 bonus for "good" or "easy"
//   +5 per streak day reached for the first time
//   +25 when an achievement unlocks
//
// Level curve: each level needs L*100 XP where L is the next level number,
// so totals are 100, 300, 600, 1000, 1500, ...

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const KEY = "xp:v1";

export interface XPState {
  total: number;
}

export function loadXP(): XPState {
  return readJSON<XPState>(KEY, { total: 0 });
}

export function saveXP(state: XPState): void {
  writeJSON(KEY, state);
  notifyStorageChange();
}

export function addXP(amount: number): XPState {
  const state = loadXP();
  state.total = Math.max(0, state.total + amount);
  saveXP(state);
  return state;
}

export function xpForLevel(level: number): number {
  // Cumulative XP needed to *reach* this level.
  // Level 1 = 0, Level 2 = 100, Level 3 = 300, Level 4 = 600, Level 5 = 1000, ...
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= level; i++) total += (i - 1) * 100;
  return total;
}

export interface LevelInfo {
  level: number;
  total: number;
  in_level: number;
  to_next: number;
  pct_to_next: number;
}

export function levelFromXP(total: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= total) level += 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const inLevel = total - base;
  const span = next - base;
  return {
    level,
    total,
    in_level: inLevel,
    to_next: Math.max(0, next - total),
    pct_to_next: span > 0 ? Math.min(100, Math.round((inLevel / span) * 100)) : 100,
  };
}

const TITLES: { min: number; title: string }[] = [
  { min: 1, title: "Recruit" },
  { min: 3, title: "Apprentice" },
  { min: 5, title: "Adept" },
  { min: 8, title: "Scholar" },
  { min: 12, title: "Sage" },
  { min: 16, title: "Master" },
  { min: 20, title: "Polymath" },
  { min: 25, title: "Memory Lord" },
];

export function levelTitle(level: number): string {
  let title = TITLES[0].title;
  for (const t of TITLES) if (level >= t.min) title = t.title;
  return title;
}
