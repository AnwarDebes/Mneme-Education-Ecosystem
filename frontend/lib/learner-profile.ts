// Derives a "learner profile" from the timing + tag + grade data already in
// localStorage. No new state is stored - this is a pure read.

import { loadTimings, modeBuckets, type ModeStat } from "./timing";
import { loadTagStats, tagAccuracy } from "./tag-stats";
import { loadStats } from "./stats";

export interface LearnerProfile {
  total_reviews: number;
  total_minutes: number;
  preferred_mode: ModeStat | null;
  fastest_mode: ModeStat | null;
  most_accurate_mode: ModeStat | null;
  strongest_tags: { tag: string; accuracy: number; total: number }[];
  weakest_tags: { tag: string; accuracy: number; total: number }[];
  best_hour: number | null;
  consistency: number;
  archetype: LearnerArchetype;
  archetype_reason: string;
}

export type LearnerArchetype =
  | "rookie"
  | "sprinter"
  | "marathoner"
  | "perfectionist"
  | "explorer"
  | "specialist";

export function deriveProfile(): LearnerProfile {
  const events = loadTimings();
  const stats = loadStats();
  const tagStats = loadTagStats();
  const modes = modeBuckets(events);

  const tagRows = Object.entries(tagStats).map(([tag, bucket]) => ({
    tag,
    ...tagAccuracy(bucket),
  }));

  const strongest = tagRows
    .filter((r) => r.total >= 5 && r.pct >= 0.7)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
    .map((r) => ({ tag: r.tag, accuracy: r.pct, total: r.total }));
  const weakest = tagRows
    .filter((r) => r.total >= 5 && r.pct < 0.6)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
    .map((r) => ({ tag: r.tag, accuracy: r.pct, total: r.total }));

  const preferred = modes.sort((a, b) => b.reviews - a.reviews)[0] ?? null;
  const fastest = modes
    .filter((m) => m.reviews >= 5)
    .sort((a, b) => a.avg_ms - b.avg_ms)[0] ?? null;
  const mostAccurate = modes
    .filter((m) => m.reviews >= 5)
    .sort((a, b) => b.accuracy - a.accuracy)[0] ?? null;

  // Best hour: hour with most reviews above 70% accuracy.
  const hourly: Record<number, { reviews: number; correct: number }> = {};
  for (const e of events) {
    if (!hourly[e.hour]) hourly[e.hour] = { reviews: 0, correct: 0 };
    hourly[e.hour].reviews += 1;
    if (e.grade === "good" || e.grade === "easy") hourly[e.hour].correct += 1;
    else if (e.grade === "hard") hourly[e.hour].correct += 0.5;
  }
  let bestHour: number | null = null;
  let bestScore = 0;
  for (const [h, v] of Object.entries(hourly)) {
    if (v.reviews < 5) continue;
    const acc = v.correct / v.reviews;
    const score = acc * Math.log2(v.reviews + 1);
    if (score > bestScore) {
      bestScore = score;
      bestHour = Number(h);
    }
  }

  const daysStudied = Object.values(stats.daily).filter((d) => d.reviewed > 0).length;
  const ageDays = stats.last_studied
    ? Math.max(1, Math.round(
        (Date.now() - new Date(stats.last_studied).getTime()) / 86400000,
      ) + daysStudied)
    : 1;
  const consistency = ageDays ? Math.min(1, daysStudied / Math.max(1, ageDays)) : 0;

  let archetype: LearnerArchetype = "rookie";
  let reason = "Just getting started. Run a few sessions to unlock more insights.";

  if (stats.total_reviewed >= 100) {
    const totalAcc = events.length
      ? (events.filter((e) => e.grade === "good" || e.grade === "easy").length +
          0.5 * events.filter((e) => e.grade === "hard").length) /
        events.length
      : 0;
    const usesManyModes = modes.length >= 4 && modes.every((m) => m.reviews >= 3);
    const avgMs =
      events.length === 0
        ? 0
        : events.reduce((a, e) => a + e.ms, 0) / events.length;
    if (totalAcc >= 0.85) {
      archetype = "perfectionist";
      reason = `${Math.round(totalAcc * 100)}% accuracy across your reviews; you don't move on until you've nailed it.`;
    } else if (avgMs < 4000) {
      archetype = "sprinter";
      reason = `Average ${Math.round(avgMs / 1000)}s per card. You go fast; consider Listen or Speed modes for more practice.`;
    } else if (consistency >= 0.5 && stats.current_streak >= 7) {
      archetype = "marathoner";
      reason = `Consistent grind: studied ${daysStudied} of the last ${ageDays} days, ${stats.current_streak}-day streak.`;
    } else if (usesManyModes) {
      archetype = "explorer";
      reason = `You've used ${modes.length} study modes. You learn best by mixing it up.`;
    } else if (preferred && preferred.reviews / Math.max(1, stats.total_reviewed) >= 0.6) {
      archetype = "specialist";
      reason = `${Math.round((preferred.reviews / Math.max(1, stats.total_reviewed)) * 100)}% of your reviews are in ${preferred.mode} mode.`;
    }
  }

  return {
    total_reviews: stats.total_reviewed,
    total_minutes: Math.round(stats.total_minutes),
    preferred_mode: preferred,
    fastest_mode: fastest,
    most_accurate_mode: mostAccurate,
    strongest_tags: strongest,
    weakest_tags: weakest,
    best_hour: bestHour,
    consistency,
    archetype,
    archetype_reason: reason,
  };
}

export const ARCHETYPE_LABEL: Record<LearnerArchetype, { name: string; emoji: string; advice: string }> = {
  rookie: {
    name: "Rookie",
    emoji: "🌱",
    advice: "Try at least 3 different study modes this week and grade honestly.",
  },
  sprinter: {
    name: "Sprinter",
    emoji: "🏃",
    advice: "Slow down on hard cards. Write mode forces you to articulate the answer.",
  },
  marathoner: {
    name: "Marathoner",
    emoji: "🏔️",
    advice: "Add the Test mode once a week to make sure speed doesn't cost depth.",
  },
  perfectionist: {
    name: "Perfectionist",
    emoji: "🎯",
    advice: "Push into harder material; AI Suggest can fill gaps in your easy deck.",
  },
  explorer: {
    name: "Explorer",
    emoji: "🧭",
    advice: "Pick one mode per topic to make A/B comparisons across decks.",
  },
  specialist: {
    name: "Specialist",
    emoji: "🔬",
    advice: "Vary modes - retrieval under different conditions strengthens memory.",
  },
};
