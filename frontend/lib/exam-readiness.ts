// Pre-flight exam readiness: heuristic score from the deck's mastery state
// + recent accuracy + topic coverage. Pure function over data we already
// store.

import { deckScheduleStats, getCardSchedule } from "./schedule";
import { loadTagStats, tagAccuracy } from "./tag-stats";
import type { ResolvedCard } from "./cards";

export interface ReadinessReport {
  score: number;
  band: "not-ready" | "shaky" | "good" | "exam-ready";
  cards_total: number;
  mastered_pct: number;
  due_now: number;
  weak_tags: { tag: string; accuracy: number; total: number }[];
  unseen: number;
  reasons: string[];
  next_step: string;
}

export function deckReadiness(deckId: string, cards: ResolvedCard[]): ReadinessReport {
  const ids = cards.map((c) => c.id);
  const stats = deckScheduleStats(deckId, ids);
  const masteredPct = cards.length ? stats.mastered / cards.length : 0;
  const dueNow = stats.due_now;

  let unseen = 0;
  let totalReps = 0;
  for (const id of ids) {
    const s = getCardSchedule(deckId, id);
    if (s.reps === 0) unseen += 1;
    totalReps += s.reps;
  }

  const tagBuckets = loadTagStats();
  const tagsInDeck = new Set<string>();
  for (const c of cards) for (const t of [...c.tags, ...c.customTags]) tagsInDeck.add(t);
  const weakTags: { tag: string; accuracy: number; total: number }[] = [];
  for (const t of tagsInDeck) {
    const b = tagBuckets[t];
    if (!b) continue;
    const { total, pct } = tagAccuracy(b);
    if (total >= 5 && pct < 0.65) {
      weakTags.push({ tag: t, accuracy: pct, total });
    }
  }
  weakTags.sort((a, b) => a.accuracy - b.accuracy);

  // Score: 60% mastery + 25% (1 - unseen ratio) + 15% (1 - weak-tag count)
  const unseenRatio = cards.length ? unseen / cards.length : 1;
  const weakPenalty = Math.min(1, weakTags.length / 5);
  const score = Math.max(
    0,
    Math.min(1, masteredPct * 0.6 + (1 - unseenRatio) * 0.25 + (1 - weakPenalty) * 0.15),
  );

  let band: ReadinessReport["band"];
  if (score >= 0.85) band = "exam-ready";
  else if (score >= 0.7) band = "good";
  else if (score >= 0.45) band = "shaky";
  else band = "not-ready";

  const reasons: string[] = [];
  if (unseen > 0) reasons.push(`${unseen} card${unseen === 1 ? "" : "s"} unseen`);
  if (dueNow > 0) reasons.push(`${dueNow} due now`);
  if (weakTags.length > 0)
    reasons.push(`weak topics: ${weakTags.slice(0, 3).map((t) => "#" + t.tag).join(", ")}`);
  if (masteredPct < 0.5) reasons.push(`only ${Math.round(masteredPct * 100)}% mastered`);
  if (totalReps < cards.length) reasons.push("most cards have fewer than 1 review on average");

  let nextStep = "Run a Cram session and a Test session over the next few days.";
  if (band === "exam-ready") nextStep = "Solid. A single Test session the day before is enough.";
  else if (band === "good") nextStep = "One more Cram + a Test 2-3 days out should seal it.";
  else if (band === "shaky") nextStep = "Run Cram now, then Quiz, then Test in 24h.";
  else nextStep = "Walk every card in Tutor mode; you don't have foundation yet.";

  return {
    score: Math.round(score * 100),
    band,
    cards_total: cards.length,
    mastered_pct: Math.round(masteredPct * 100),
    due_now: dueNow,
    weak_tags: weakTags.slice(0, 5),
    unseen,
    reasons,
    next_step: nextStep,
  };
}
