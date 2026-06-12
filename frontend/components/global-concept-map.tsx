"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptMap } from "@/components/concept-map";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";

export function GlobalConceptMap() {
  const [allCards, setAllCards] = useState<ResolvedCard[] | null>(null);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        const all: ResolvedCard[] = [];
        await Promise.all(
          done.map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              for (const c of resolveDeck(j.id, d.cards)) all.push(c);
            } catch {
              /* skip */
            }
          }),
        );
        setAllCards(all);
      })
      .catch(() => setAllCards([]));
  }, []);

  if (allCards === null) {
    return (
      <div className="grid place-items-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (allCards.length === 0) {
    return null;
  }

  return <ConceptMap cards={allCards} />;
}
