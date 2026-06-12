// Pre-flip confidence ratings + calibration stats. The user predicts how
// well they'll do before flipping; we compare to the actual grade to build
// a calibration plot.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export interface ConfidenceEvent {
  ts: string;
  deck_id: string;
  card_id: string;
  predicted: 1 | 2 | 3 | 4 | 5;
  actual: "again" | "hard" | "good" | "easy";
}

const KEY = "confidence:v1";
const MAX = 1000;

export function logConfidence(event: Omit<ConfidenceEvent, "ts">): void {
  const events = readJSON<ConfidenceEvent[]>(KEY, []);
  events.push({ ...event, ts: new Date().toISOString() });
  if (events.length > MAX) events.splice(0, events.length - MAX);
  writeJSON(KEY, events);
  notifyStorageChange();
}

export function loadConfidence(): ConfidenceEvent[] {
  return readJSON<ConfidenceEvent[]>(KEY, []);
}

export interface CalibrationBucket {
  predicted: number;
  count: number;
  accuracy: number;
}

export function calibration(): CalibrationBucket[] {
  const events = loadConfidence();
  const buckets = [1, 2, 3, 4, 5].map((p) => {
    const subset = events.filter((e) => e.predicted === p);
    const correct = subset.filter((e) => e.actual === "good" || e.actual === "easy").length;
    const partial = subset.filter((e) => e.actual === "hard").length;
    const total = subset.length;
    const acc = total ? (correct + 0.5 * partial) / total : 0;
    return { predicted: p, count: total, accuracy: acc };
  });
  return buckets;
}
