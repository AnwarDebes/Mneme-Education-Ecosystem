// Records per-grade timing across every mode: how long the student took
// from "card shown" to "grade pressed". Used by Insights to surface
// time-to-answer per mode and best-hour-of-day for accuracy.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

const KEY = "timing:v1";

export interface TimingEvent {
  ts: string;
  mode: string;
  grade: "again" | "hard" | "good" | "easy";
  ms: number;
  hour: number;
}

const MAX = 2000;

export function recordTiming(event: Omit<TimingEvent, "ts" | "hour">): void {
  const now = new Date();
  const evt: TimingEvent = {
    ...event,
    ts: now.toISOString(),
    hour: now.getHours(),
  };
  const events = readJSON<TimingEvent[]>(KEY, []);
  events.push(evt);
  if (events.length > MAX) events.splice(0, events.length - MAX);
  writeJSON(KEY, events);
  notifyStorageChange();
}

export function loadTimings(): TimingEvent[] {
  return readJSON<TimingEvent[]>(KEY, []);
}

export interface HourBucket {
  hour: number;
  reviews: number;
  accuracy: number;
  avg_ms: number;
}

export function hourlyBuckets(events: TimingEvent[]): HourBucket[] {
  const buckets: { reviews: number; right: number; ms: number }[] = Array.from(
    { length: 24 },
    () => ({ reviews: 0, right: 0, ms: 0 }),
  );
  for (const e of events) {
    if (e.hour < 0 || e.hour > 23) continue;
    const b = buckets[e.hour];
    b.reviews += 1;
    b.ms += e.ms;
    if (e.grade === "good" || e.grade === "easy") b.right += 1;
    else if (e.grade === "hard") b.right += 0.5;
  }
  return buckets.map((b, hour) => ({
    hour,
    reviews: b.reviews,
    accuracy: b.reviews ? b.right / b.reviews : 0,
    avg_ms: b.reviews ? b.ms / b.reviews : 0,
  }));
}

export interface ModeStat {
  mode: string;
  reviews: number;
  avg_ms: number;
  accuracy: number;
}

export function modeBuckets(events: TimingEvent[]): ModeStat[] {
  const map = new Map<string, { reviews: number; ms: number; right: number }>();
  for (const e of events) {
    const cur = map.get(e.mode) ?? { reviews: 0, ms: 0, right: 0 };
    cur.reviews += 1;
    cur.ms += e.ms;
    if (e.grade === "good" || e.grade === "easy") cur.right += 1;
    else if (e.grade === "hard") cur.right += 0.5;
    map.set(e.mode, cur);
  }
  return Array.from(map.entries()).map(([mode, b]) => ({
    mode,
    reviews: b.reviews,
    avg_ms: b.reviews ? b.ms / b.reviews : 0,
    accuracy: b.reviews ? b.right / b.reviews : 0,
  }));
}
