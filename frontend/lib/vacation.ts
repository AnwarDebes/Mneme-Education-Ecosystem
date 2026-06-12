// Vacation mode: pause the streak counter without losing the current
// streak. While active, daily streak increment skips. Resume restores
// today as the last-studied date so the streak picks up where it left off.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const KEY = "vacation:v1";

export interface VacationState {
  active: boolean;
  started_at: string | null;
}

export function loadVacation(): VacationState {
  return readJSON<VacationState>(KEY, { active: false, started_at: null });
}

export function setVacationActive(active: boolean): VacationState {
  const v: VacationState = {
    active,
    started_at: active ? new Date().toISOString() : null,
  };
  writeJSON(KEY, v);
  notifyStorageChange();
  return v;
}
