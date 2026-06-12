// Heuristic card quality grader. No LLM call needed; scores against simple
// signals (length, repetition, leading punctuation, question word presence).
// Returns 0-100 plus reasons.

import type { ResolvedCard } from "./cards";

export interface QualityReport {
  score: number;
  signals: { name: string; ok: boolean; weight: number }[];
}

const QUESTION_WORDS = /\b(what|why|how|when|where|which|who|name|define|describe|explain|list)\b/i;

export function gradeCardQuality(card: ResolvedCard): QualityReport {
  const q = card.question.trim();
  const a = card.answer.trim();
  const signals: QualityReport["signals"] = [];

  const ok = (name: string, cond: boolean, weight = 1) => signals.push({ name, ok: cond, weight });

  ok("Has question mark", q.endsWith("?"), 1);
  ok("Starts with question word", QUESTION_WORDS.test(q.slice(0, 30)), 1.5);
  ok("Question length 6-180 chars", q.length >= 6 && q.length <= 180, 2);
  ok("Answer length 1-200 chars", a.length >= 1 && a.length <= 200, 2);
  ok("Question and answer differ", q.trim().toLowerCase() !== a.trim().toLowerCase(), 3);
  ok("Question is not just the answer", !q.toLowerCase().includes(a.toLowerCase()) || a.length < 4, 2);
  ok("No HTML in fields", !/<[^>]+>/.test(q) && !/<[^>]+>/.test(a), 1);
  ok("Answer is not a placeholder", !/(tbd|todo|n\/a|none|see card)/i.test(a), 2);
  ok("Answer has at least one alphabetic char", /[a-zA-Z]/.test(a), 1);

  const totalWeight = signals.reduce((acc, s) => acc + s.weight, 0);
  const earned = signals.reduce((acc, s) => acc + (s.ok ? s.weight : 0), 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  return { score, signals };
}

export function deckQualityReport(cards: ResolvedCard[]): {
  avg: number;
  weak: { card: ResolvedCard; score: number }[];
} {
  if (cards.length === 0) return { avg: 0, weak: [] };
  let sum = 0;
  const all: { card: ResolvedCard; score: number }[] = [];
  for (const c of cards) {
    const r = gradeCardQuality(c);
    sum += r.score;
    all.push({ card: c, score: r.score });
  }
  const avg = Math.round(sum / cards.length);
  const weak = all
    .filter((c) => c.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);
  return { avg, weak };
}
