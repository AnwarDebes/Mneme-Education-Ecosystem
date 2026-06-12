// Per-card retention prediction. Same exponential-decay model as the
// decay simulator, but evaluated at the elapsed time since last review.
// retention(t) = exp(-t / stability), stability proxy = interval * (ease - 1.3).

import { getCardSchedule } from "./schedule";

export function predictRetention(deckId: string, cardId: string, now = Date.now()): number {
  const s = getCardSchedule(deckId, cardId);
  if (!s.last_graded) return 0.5;
  const elapsedMs = now - new Date(s.last_graded).getTime();
  const elapsedDays = Math.max(0, elapsedMs / 86400000);
  const stability = Math.max(0.5, s.interval_days * Math.max(0.1, s.ease - 1.3));
  return Math.exp(-elapsedDays / stability);
}

export interface DeckRetentionStats {
  by_band: { p100_90: number; p90_75: number; p75_50: number; below_50: number; unseen: number };
  total: number;
  median: number;
  mean: number;
}

export function deckRetention(deckId: string, cardIds: string[]): DeckRetentionStats {
  const stats: DeckRetentionStats = {
    by_band: { p100_90: 0, p90_75: 0, p75_50: 0, below_50: 0, unseen: 0 },
    total: cardIds.length,
    median: 0,
    mean: 0,
  };
  const vals: number[] = [];
  for (const id of cardIds) {
    const s = getCardSchedule(deckId, id);
    if (s.reps === 0) {
      stats.by_band.unseen += 1;
      continue;
    }
    const r = predictRetention(deckId, id);
    vals.push(r);
    if (r >= 0.9) stats.by_band.p100_90 += 1;
    else if (r >= 0.75) stats.by_band.p90_75 += 1;
    else if (r >= 0.5) stats.by_band.p75_50 += 1;
    else stats.by_band.below_50 += 1;
  }
  if (vals.length > 0) {
    vals.sort((a, b) => a - b);
    stats.median = vals[Math.floor(vals.length / 2)];
    stats.mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return stats;
}
