// Cross-deck near-duplicate finder. Uses Jaccard token overlap as a cheap
// proxy for semantic similarity; cards above the threshold are flagged.

import type { ResolvedCard } from "./cards";

export interface DuplicateGroup {
  representative: { deckId: string; deckName: string; card: ResolvedCard };
  matches: { deckId: string; deckName: string; card: ResolvedCard; similarity: number }[];
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect += 1;
  return intersect / (a.size + b.size - intersect);
}

interface InputDeck {
  deckId: string;
  deckName: string;
  cards: ResolvedCard[];
}

export function findDuplicateGroups(
  decks: InputDeck[],
  threshold = 0.55,
): DuplicateGroup[] {
  type Entry = { deckId: string; deckName: string; card: ResolvedCard; bag: Set<string> };
  const entries: Entry[] = [];
  for (const d of decks) {
    for (const c of d.cards) {
      entries.push({
        deckId: d.deckId,
        deckName: d.deckName,
        card: c,
        bag: tokens(`${c.question} ${c.answer}`),
      });
    }
  }

  const seen = new Set<string>();
  const groups: DuplicateGroup[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (seen.has(entries[i].card.id)) continue;
    const matches: DuplicateGroup["matches"] = [];
    for (let j = i + 1; j < entries.length; j++) {
      if (seen.has(entries[j].card.id)) continue;
      const sim = jaccard(entries[i].bag, entries[j].bag);
      if (sim >= threshold) {
        matches.push({
          deckId: entries[j].deckId,
          deckName: entries[j].deckName,
          card: entries[j].card,
          similarity: sim,
        });
        seen.add(entries[j].card.id);
      }
    }
    if (matches.length > 0) {
      seen.add(entries[i].card.id);
      groups.push({
        representative: {
          deckId: entries[i].deckId,
          deckName: entries[i].deckName,
          card: entries[i].card,
        },
        matches: matches.sort((a, b) => b.similarity - a.similarity),
      });
    }
  }
  return groups.sort((a, b) => b.matches.length - a.matches.length);
}
