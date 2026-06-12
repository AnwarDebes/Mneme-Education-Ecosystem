// Pomodoro session log: every completed focus pomodoro is appended.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const KEY = "pomodoro:history";

export interface PomodoroEntry {
  ts: string;
  minutes: number;
}

export function logPomodoro(minutes: number): void {
  const list = readJSON<PomodoroEntry[]>(KEY, []);
  list.push({ ts: new Date().toISOString(), minutes });
  if (list.length > 1000) list.splice(0, list.length - 1000);
  writeJSON(KEY, list);
  notifyStorageChange();
}

export function loadPomodoroHistory(): PomodoroEntry[] {
  return readJSON<PomodoroEntry[]>(KEY, []);
}
