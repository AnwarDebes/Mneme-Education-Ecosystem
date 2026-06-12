// Aggregate the daily stats into weekly / monthly buckets so we can plot
// growth over time. Pure read-only over the existing GlobalStats.

import type { GlobalStats } from "./stats";

export interface Bucket {
  key: string;
  label: string;
  reviewed: number;
  minutes: number;
  accuracy: number;
  active_days: number;
}

function isoWeekKey(d: Date): string {
  // ISO week: Monday-start, 1-based.
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function bucketStats(
  stats: GlobalStats,
  by: "week" | "month",
  count: number,
): Bucket[] {
  const today = new Date();
  const buckets = new Map<string, { reviewed: number; minutes: number; correct: number; total_graded: number; days: Set<string> }>();
  for (const day of Object.values(stats.daily)) {
    const d = new Date(day.date + "T00:00:00");
    const key = by === "week" ? isoWeekKey(d) : monthKey(d);
    if (!buckets.has(key)) buckets.set(key, { reviewed: 0, minutes: 0, correct: 0, total_graded: 0, days: new Set() });
    const b = buckets.get(key)!;
    b.reviewed += day.reviewed;
    b.minutes += day.minutes;
    if (day.reviewed > 0) b.days.add(day.date);
    b.correct += day.good + day.easy + day.hard * 0.5;
    b.total_graded += day.reviewed;
  }

  // Build the last N buckets, including empty ones.
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    if (by === "week") d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);
    const key = by === "week" ? isoWeekKey(d) : monthKey(d);
    const b = buckets.get(key) ?? { reviewed: 0, minutes: 0, correct: 0, total_graded: 0, days: new Set() };
    const label =
      by === "week"
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : d.toLocaleDateString(undefined, { month: "short" });
    out.push({
      key,
      label,
      reviewed: b.reviewed,
      minutes: Math.round(b.minutes),
      accuracy: b.total_graded ? b.correct / b.total_graded : 0,
      active_days: b.days.size,
    });
  }
  return out;
}
