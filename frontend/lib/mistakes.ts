// Aggregator over the per-deck schedule store + tag-stats to build a global
// "error book": every card you've graded `again` at least once across every
// deck, ranked by how many lapses you've accumulated.

import { getCardSchedule, loadDeckSchedule } from "./schedule";
import { loadTagStats, tagAccuracy } from "./tag-stats";
import type { JobSummary, Card as CardData } from "./types";
import type { ResolvedCard } from "./cards";

export interface MistakeEntry {
  deckId: string;
  deckName: string;
  card: ResolvedCard;
  lapses: number;
  reps: number;
  ease: number;
  last_graded: string | null;
}

export function gatherMistakes(
  jobs: JobSummary[],
  resolveDeck: (deckId: string, cards: CardData[]) => ResolvedCard[],
  cardsByDeck: Record<string, CardData[]>,
  deckNameById: Map<string, string>,
): MistakeEntry[] {
  const out: MistakeEntry[] = [];
  for (const job of jobs) {
    const raw = cardsByDeck[job.id] ?? [];
    if (raw.length === 0) continue;
    const resolved = resolveDeck(job.id, raw);
    const sched = loadDeckSchedule(job.id);
    for (const card of resolved) {
      const s = sched[card.id];
      if (!s || s.lapses === 0) continue;
      out.push({
        deckId: job.id,
        deckName: deckNameById.get(job.id) ?? job.filename,
        card,
        lapses: s.lapses,
        reps: s.reps,
        ease: s.ease,
        last_graded: s.last_graded,
      });
    }
  }
  return out.sort((a, b) => b.lapses - a.lapses || a.ease - b.ease);
}

export interface MistakePattern {
  tag: string;
  total: number;
  accuracy: number;
  lapses: number;
  message: string;
}

export function detectPatterns(mistakes: MistakeEntry[]): MistakePattern[] {
  // Tally lapses by tag.
  const tagLapses = new Map<string, number>();
  for (const m of mistakes) {
    const tags = [...m.card.tags, ...m.card.customTags];
    for (const t of tags) {
      tagLapses.set(t, (tagLapses.get(t) ?? 0) + m.lapses);
    }
  }
  const tagStats = loadTagStats();
  const out: MistakePattern[] = [];
  for (const [tag, lapses] of tagLapses.entries()) {
    const bucket = tagStats[tag];
    if (!bucket) continue;
    const { total, pct } = tagAccuracy(bucket);
    if (total < 5) continue;
    if (pct >= 0.7) continue;
    out.push({
      tag,
      total,
      accuracy: pct,
      lapses,
      message: `You struggle most with #${tag}: ${Math.round(pct * 100)}% accuracy across ${total} reviews.`,
    });
  }
  return out.sort((a, b) => b.lapses - a.lapses).slice(0, 5);
}

// --- Glossary auto-extraction ---

const DEF_PATTERNS = [
  / is (?:a|an|the) /i,
  / refers to /i,
  / means /i,
  / defined as /i,
  / known as /i,
];

export interface GlossaryEntry {
  term: string;
  definition: string;
  source: string;
  cardId: string;
}

function looksLikeDefinition(s: string): boolean {
  return DEF_PATTERNS.some((p) => p.test(s));
}

function termFromQuestion(q: string): string | null {
  // Common Q patterns: "What is X?", "Define X.", "X means what?"
  const m1 = q.match(/^\s*what (?:is|are|does|do) (?:an?|the )?([^.?]+)[?.]?$/i);
  if (m1) return m1[1].trim();
  const m2 = q.match(/^\s*define\s+([^.?]+)[?.]?$/i);
  if (m2) return m2[1].trim();
  const m3 = q.match(/^\s*([^:?\n]+?)\s*\?\s*$/);
  if (m3 && m3[1].split(" ").length <= 5) return m3[1].trim();
  return null;
}

export function extractGlossary(cards: ResolvedCard[]): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  for (const c of cards) {
    const term = termFromQuestion(c.question);
    if (term && c.answer && c.answer.length < 240) {
      out.push({
        term,
        definition: c.answer,
        source: c.source_fact || "",
        cardId: c.id,
      });
      continue;
    }
    if (c.source_fact && looksLikeDefinition(c.source_fact) && c.source_fact.length < 240) {
      // Try to extract X "is a" Y phrase.
      const m = c.source_fact.match(/^\s*(?:The |An? )?([A-Z][^.]{2,80}?)\s+(?:is|are)\s+(.+?)\.?$/);
      if (m) {
        out.push({
          term: m[1].trim(),
          definition: m[2].trim(),
          source: c.source_fact,
          cardId: c.id,
        });
      }
    }
  }
  // Dedupe by term.
  const seen = new Set<string>();
  return out
    .filter((e) => {
      const key = e.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
}
