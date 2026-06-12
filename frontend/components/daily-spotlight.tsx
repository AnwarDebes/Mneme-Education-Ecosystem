"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { isoDate } from "@/lib/stats";
import { RichText } from "@/components/rich-text";

interface Spotlight {
  card: ResolvedCard;
  deckId: string;
  deckName: string;
}

function hashDate(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

export function DailySpotlight() {
  const [spot, setSpot] = useState<Spotlight | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        if (done.length === 0) return;
        // Pick a deck deterministically by date so the spotlight is stable per day.
        const seed = hashDate(isoDate());
        const deck = done[seed % done.length];
        try {
          const d = await jobDetail(deck.id);
          const resolved = resolveDeck(deck.id, d.cards).filter((c) => !c.archived);
          if (resolved.length === 0) return;
          const card = resolved[seed % resolved.length];
          setSpot({ card, deckId: deck.id, deckName: loadDeckMeta(deck.id).alias || deck.filename });
        } catch {
          /* skip */
        }
      })
      .catch(() => {});
  }, []);

  if (!spot) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" /> Daily spotlight
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {spot.deckName}
            </Badge>
          </div>
          <RichText text={spot.card.question} className="font-display text-xl font-medium leading-snug" />
          {revealed ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <RichText
                text={spot.card.answer}
                className="rounded-md bg-card p-3 text-sm shadow-sm"
              />
            </motion.div>
          ) : (
            <Button variant="outline" onClick={() => setRevealed(true)}>
              Reveal answer
            </Button>
          )}
          <div className="flex justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/decks/${spot.deckId}` as any}>
                Open deck <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
