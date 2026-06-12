// Tiny inverted-index search so the cross-deck Search page stays fast as
// the corpus grows. Built incrementally on demand; recomputed when card
// counts change. Cap at top-N results.

import type { ResolvedCard } from "./cards";

interface IndexedCard {
  deckId: string;
  card: ResolvedCard;
  tokens: Set<string>;
}

export interface SearchIndex {
  cards: IndexedCard[];
  byToken: Map<string, number[]>;
  // IDF per token: log(N / df) - rarer tokens score higher.
  idf: Map<string, number>;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildIndex(decks: { deckId: string; cards: ResolvedCard[] }[]): SearchIndex {
  const idx: SearchIndex = { cards: [], byToken: new Map(), idf: new Map() };
  for (const d of decks) {
    for (const c of d.cards) {
      const tks = new Set<string>([
        ...tokens(c.question),
        ...tokens(c.answer),
        ...tokens(c.notes || ""),
        ...tokens(c.source_fact || ""),
        ...c.tags,
        ...c.customTags,
      ]);
      const pos = idx.cards.length;
      idx.cards.push({ deckId: d.deckId, card: c, tokens: tks });
      for (const t of tks) {
        let arr = idx.byToken.get(t);
        if (!arr) {
          arr = [];
          idx.byToken.set(t, arr);
        }
        arr.push(pos);
      }
    }
  }
  const N = idx.cards.length;
  for (const [token, postings] of idx.byToken) {
    const df = postings.length;
    // smoothed log IDF; cap at 0 so common tokens carry zero weight
    idx.idf.set(token, Math.max(0, Math.log((N + 1) / (df + 1))));
  }
  return idx;
}

export interface IndexHit {
  deckId: string;
  card: ResolvedCard;
  score: number;
}

export function searchIndex(index: SearchIndex, query: string, limit = 60): IndexHit[] {
  const q = query.trim();
  if (!q) return [];
  const qTokens = tokens(q);
  if (qTokens.length === 0) return [];

  const scores = new Map<number, number>();
  for (const t of qTokens) {
    const candidates = index.byToken.get(t);
    if (!candidates) continue;
    const weight = index.idf.get(t) ?? 0;
    for (const pos of candidates) {
      scores.set(pos, (scores.get(pos) ?? 0) + weight);
    }
  }

  // Bonus for exact substring in question/answer. Use a multiplier scaled
  // to the query's own IDF mass so the bonus stays meaningful regardless
  // of how many terms the user typed.
  const qIdfMass = qTokens.reduce((acc, t) => acc + (index.idf.get(t) ?? 0), 0);
  const substringBonus = Math.max(1, qIdfMass);
  for (const [pos, score] of scores) {
    const c = index.cards[pos].card;
    const lower = `${c.question} ${c.answer}`.toLowerCase();
    if (lower.includes(q.toLowerCase())) {
      scores.set(pos, score + substringBonus);
    }
  }

  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([pos, score]) => ({
      deckId: index.cards[pos].deckId,
      card: index.cards[pos].card,
      score,
    }));
  return sorted;
}
