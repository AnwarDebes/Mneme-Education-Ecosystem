// Smarter card ordering for study sessions:
//   - Mistake-aware boost: cards similar to recently lapsed ones bubble up
//   - Smart shuffle: interleave hard and easy rather than block all-easy
//   - Least-seen: surface cards with the fewest total reps first
//
// All pure functions; the caller decides which to use.

import type { ResolvedCard } from "./cards";
import { getCardSchedule } from "./schedule";

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function mistakeAwareOrder(
  deckId: string,
  cards: ResolvedCard[],
): ResolvedCard[] {
  const lapsed: ResolvedCard[] = [];
  for (const c of cards) {
    const s = getCardSchedule(deckId, c.id);
    if (s.lapses > 0) lapsed.push(c);
  }
  if (lapsed.length === 0) return cards.slice();

  const lapsedBags = lapsed.map((c) => tokens(`${c.question} ${c.answer}`));
  const scored = cards.map((c) => {
    const sch = getCardSchedule(deckId, c.id);
    const own = tokens(`${c.question} ${c.answer}`);
    let bestSim = 0;
    for (const lb of lapsedBags) {
      const sim = similarity(own, lb);
      if (sim > bestSim) bestSim = sim;
    }
    // Score: lapses count + neighbor similarity, slight boost for hard cards.
    const hardWeight = c.effective_difficulty === "hard" ? 0.2 : 0;
    const score = sch.lapses * 1.5 + bestSim + hardWeight;
    return { card: c, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);
}

export function smartShuffle(cards: ResolvedCard[]): ResolvedCard[] {
  // Group by difficulty, then weave them: easy/hard/medium/hard/easy/...
  const easy = cards.filter((c) => c.effective_difficulty === "easy");
  const med = cards.filter((c) => c.effective_difficulty === "medium" || c.effective_difficulty == null);
  const hard = cards.filter((c) => c.effective_difficulty === "hard");
  // Cheap shuffle inside each bucket.
  for (const bucket of [easy, med, hard]) {
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
  }
  const out: ResolvedCard[] = [];
  while (easy.length || med.length || hard.length) {
    if (med.length) out.push(med.shift()!);
    if (hard.length) out.push(hard.shift()!);
    if (easy.length) out.push(easy.shift()!);
    if (hard.length) out.push(hard.shift()!);
  }
  return out;
}

export function leastSeenOrder(deckId: string, cards: ResolvedCard[]): ResolvedCard[] {
  return cards
    .map((c) => ({ card: c, reps: getCardSchedule(deckId, c.id).reps }))
    .sort((a, b) => a.reps - b.reps)
    .map((x) => x.card);
}
