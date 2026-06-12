// Smart retirement: auto-archive cards that are demonstrably mastered
// (many successful reps + long interval + no recent lapses). The user
// keeps the deck lean; retired cards still ship in exports.

import { loadDeckMeta, saveDeckMeta } from "./deck-store";
import { getCardSchedule, type CardSchedule } from "./schedule";

export interface RetirementCandidate {
  cardId: string;
  reps: number;
  interval_days: number;
  ease: number;
  last_graded: string | null;
  reason: string;
}

export interface RetirementCriteria {
  min_reps: number;
  min_interval_days: number;
  min_ease: number;
  max_lapses: number;
  min_days_since_last_grade: number;
}

export const DEFAULT_CRITERIA: RetirementCriteria = {
  min_reps: 5,
  min_interval_days: 30,
  min_ease: 2.5,
  max_lapses: 0,
  min_days_since_last_grade: 14,
};

export function findRetirementCandidates(
  deckId: string,
  cardIds: string[],
  criteria: RetirementCriteria = DEFAULT_CRITERIA,
): RetirementCandidate[] {
  const out: RetirementCandidate[] = [];
  const now = Date.now();
  for (const cid of cardIds) {
    const s: CardSchedule = getCardSchedule(deckId, cid);
    if (s.reps < criteria.min_reps) continue;
    if (s.interval_days < criteria.min_interval_days) continue;
    if (s.ease < criteria.min_ease) continue;
    if (s.lapses > criteria.max_lapses) continue;
    if (!s.last_graded) continue;
    const daysSince = (now - new Date(s.last_graded).getTime()) / 86400000;
    if (daysSince < criteria.min_days_since_last_grade) continue;
    out.push({
      cardId: cid,
      reps: s.reps,
      interval_days: s.interval_days,
      ease: s.ease,
      last_graded: s.last_graded,
      reason: `${s.reps} reps, ${Math.round(s.interval_days)}-day interval, ease ${s.ease.toFixed(2)}, ${s.lapses} lapses`,
    });
  }
  return out;
}

export function retireCards(deckId: string, cardIds: string[]): number {
  const meta = loadDeckMeta(deckId);
  let n = 0;
  for (const cid of cardIds) {
    const cur = meta.cards[cid] ?? {};
    if (!cur.archived) {
      meta.cards[cid] = { ...cur, archived: true };
      n += 1;
    }
  }
  saveDeckMeta(deckId, meta);
  return n;
}
