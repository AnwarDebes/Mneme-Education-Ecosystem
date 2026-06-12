// Streak freezes: consumable items earned by reaching XP milestones.
// One freeze lets the user skip a day without breaking the streak.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate } from "./stats";

const KEY = "streak-freeze:v1";

export interface FreezeState {
  available: number;
  used_on: string[];
  earned_at_xp: number[];
}

const MILESTONES = [200, 500, 1000, 2000, 4000];

export function loadFreezes(): FreezeState {
  return readJSON<FreezeState>(KEY, { available: 0, used_on: [], earned_at_xp: [] });
}

export function saveFreezes(state: FreezeState): void {
  writeJSON(KEY, state);
  notifyStorageChange();
}

export function syncFreezesFromXP(totalXP: number): FreezeState {
  const state = loadFreezes();
  for (const m of MILESTONES) {
    if (totalXP >= m && !state.earned_at_xp.includes(m)) {
      state.earned_at_xp.push(m);
      state.available += 1;
    }
  }
  saveFreezes(state);
  return state;
}

export function consumeFreeze(): boolean {
  const state = loadFreezes();
  if (state.available <= 0) return false;
  const today = isoDate();
  if (state.used_on.includes(today)) return false;
  state.available -= 1;
  state.used_on.push(today);
  saveFreezes(state);
  return true;
}
