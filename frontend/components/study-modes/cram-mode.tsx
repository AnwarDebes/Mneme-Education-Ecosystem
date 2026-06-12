"use client";
import { useMemo } from "react";
import { FlipMode } from "@/components/study-modes/flip-mode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dueCardIds, getCardSchedule } from "@/lib/schedule";
import { mistakeAwareOrder } from "@/lib/smart-order";
import type { ResolvedCard } from "@/lib/cards";

interface CramModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function CramMode({ deckId, cards }: CramModeProps) {
  const subset = useMemo(() => {
    const dueSet = new Set(dueCardIds(deckId, cards.map((c) => c.id)));
    const lapsed = cards.filter((c) => {
      const s = getCardSchedule(deckId, c.id);
      return s.lapses > 0 || dueSet.has(c.id);
    });
    if (lapsed.length === 0) {
      const overrides = cards.filter((c) => c.effective_difficulty === "hard");
      if (overrides.length > 0) return mistakeAwareOrder(deckId, overrides);
      return mistakeAwareOrder(deckId, cards);
    }
    // Mistake-aware order pulls lapsed cards + their topical neighbors first.
    return mistakeAwareOrder(deckId, lapsed.concat(cards.filter((c) => !lapsed.includes(c))));
  }, [deckId, cards]);

  if (subset.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-display">Nothing to cram</CardTitle>
          <CardDescription>
            You haven't graded any cards yet, and nothing is marked hard. Run a
            Flip or Quiz session first; Cram queues up the ones you missed.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }

  return <FlipMode deckId={deckId} cards={subset} />;
}
