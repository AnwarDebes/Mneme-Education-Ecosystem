// Helpers that combine the backend card payload with the local override
// store. Everywhere we render cards, we should call ``resolveCard`` so
// edits, favorites, and overrides flow through transparently.

import type { Card as CardData } from "./types";
import { loadDeckMeta, type CardOverride } from "./deck-store";

export interface ResolvedCard extends CardData {
  favorite: boolean;
  archived: boolean;
  notes: string;
  customTags: string[];
  edited: boolean;
  effective_difficulty: "easy" | "medium" | "hard" | null;
}

export function resolveCard(deckId: string, card: CardData): ResolvedCard {
  const meta = loadDeckMeta(deckId);
  return applyOverride(card, meta.cards[card.id]);
}

export function resolveDeck(deckId: string, cards: CardData[]): ResolvedCard[] {
  const meta = loadDeckMeta(deckId);
  return cards.map((c) => applyOverride(c, meta.cards[c.id]));
}

function applyOverride(card: CardData, override?: CardOverride): ResolvedCard {
  const o = override ?? {};
  return {
    ...card,
    question: o.question ?? card.question,
    answer: o.answer ?? card.answer,
    notes: o.notes ?? "",
    customTags: o.customTags ?? [],
    favorite: !!o.favorite,
    archived: !!o.archived,
    edited:
      typeof o.question === "string" ||
      typeof o.answer === "string" ||
      typeof o.notes === "string",
    effective_difficulty: o.difficultyOverride ?? card.difficulty,
  };
}

export function uniqueTags(cards: ResolvedCard[]): string[] {
  const set = new Set<string>();
  for (const c of cards) {
    for (const t of c.tags) set.add(t);
    for (const t of c.customTags) set.add(t);
  }
  return Array.from(set).sort();
}
