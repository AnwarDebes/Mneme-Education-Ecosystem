// User-defined achievements. Each has a target metric + threshold + a name.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { loadStats } from "./stats";

export type CustomMetric = "total_reviews" | "current_streak" | "minutes" | "days_studied";

export interface CustomAchievement {
  id: string;
  name: string;
  metric: CustomMetric;
  threshold: number;
  icon: string;
  created_at: string;
}

const KEY = "achievements:custom";

export function loadCustom(): CustomAchievement[] {
  return readJSON<CustomAchievement[]>(KEY, []);
}

export function saveCustom(list: CustomAchievement[]): void {
  writeJSON(KEY, list);
  notifyStorageChange();
}

export function createCustom(name: string, metric: CustomMetric, threshold: number, icon = "🏆"): CustomAchievement {
  const a: CustomAchievement = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Custom achievement",
    metric,
    threshold: Math.max(1, threshold),
    icon: icon || "🏆",
    created_at: new Date().toISOString(),
  };
  const cur = loadCustom();
  cur.push(a);
  saveCustom(cur);
  return a;
}

export function deleteCustom(id: string): void {
  saveCustom(loadCustom().filter((a) => a.id !== id));
}

export function checkCustom(a: CustomAchievement): { progress: number; achieved: boolean } {
  const stats = loadStats();
  let cur = 0;
  if (a.metric === "total_reviews") cur = stats.total_reviewed;
  else if (a.metric === "current_streak") cur = stats.current_streak;
  else if (a.metric === "minutes") cur = Math.round(stats.total_minutes);
  else if (a.metric === "days_studied") cur = Object.keys(stats.daily).length;
  return { progress: cur, achieved: cur >= a.threshold };
}
