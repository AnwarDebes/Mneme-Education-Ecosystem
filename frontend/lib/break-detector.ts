// Tracks consecutive review duration. After N minutes of continuous study
// with no >5 min break, surface a "take a break" hint via toast.

import { loadTimings } from "./timing";

export interface BreakSuggestion {
  should_break: boolean;
  minutes_continuous: number;
  reason: string;
}

const CONTINUOUS_THRESHOLD_MIN = 45;
const BREAK_GAP_MIN = 5;

export function checkForBreak(): BreakSuggestion {
  const events = loadTimings();
  if (events.length === 0) {
    return { should_break: false, minutes_continuous: 0, reason: "" };
  }
  // Walk back from the latest event; sum elapsed minutes until we hit a
  // gap > BREAK_GAP_MIN.
  let minutes = 0;
  for (let i = events.length - 1; i >= 1; i--) {
    const curT = new Date(events[i].ts).getTime();
    const prevT = new Date(events[i - 1].ts).getTime();
    const gapMin = (curT - prevT) / 60000;
    if (gapMin > BREAK_GAP_MIN) break;
    minutes += Math.min(2, gapMin) + events[i].ms / 60000;
  }
  // Add the latest event's own time.
  minutes += events[events.length - 1].ms / 60000;
  const should = minutes >= CONTINUOUS_THRESHOLD_MIN;
  return {
    should_break: should,
    minutes_continuous: Math.round(minutes),
    reason: should
      ? `You've been studying for ~${Math.round(minutes)} continuous minutes. A 5-10 min break helps consolidate.`
      : "",
  };
}
