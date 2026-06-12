"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStorageVersion } from "@/lib/hooks";
import {
  DEFAULT_CRITERIA,
  findRetirementCandidates,
  retireCards,
} from "@/lib/retirement";
import type { ResolvedCard } from "@/lib/cards";
import { truncate } from "@/lib/utils";
import { toast } from "sonner";

interface RetirementPanelProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function RetirementPanel({ deckId, cards }: RetirementPanelProps) {
  const version = useStorageVersion();
  const [pending, setPending] = useState(false);
  const candidates = useMemo(() => {
    const ids = cards.filter((c) => !c.archived).map((c) => c.id);
    return findRetirementCandidates(deckId, ids, DEFAULT_CRITERIA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, cards, version]);

  const byId = new Map(cards.map((c) => [c.id, c]));

  if (candidates.length === 0) return null;

  const retireAll = () => {
    setPending(true);
    const n = retireCards(deckId, candidates.map((c) => c.cardId));
    toast.success(`Retired ${n} mastered card${n === 1 ? "" : "s"}`);
    setPending(false);
  };

  return (
    <Card className="border-success/30 bg-success/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <p className="font-display text-lg font-semibold">Mastered cards</p>
            <Badge variant="outline" className="border-success/50 text-success">
              {candidates.length} ready to retire
            </Badge>
          </div>
          <Button onClick={retireAll} disabled={pending} size="sm">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Retire all
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cards with at least {DEFAULT_CRITERIA.min_reps} reps, a{" "}
          {DEFAULT_CRITERIA.min_interval_days}-day interval, ease &gt;= {DEFAULT_CRITERIA.min_ease.toFixed(1)}, no
          lapses, and last seen at least {DEFAULT_CRITERIA.min_days_since_last_grade} days ago. They stay in the deck
          (and exports), just archived from daily review.
        </p>
        <AnimatePresence>
          <div className="space-y-1.5">
            {candidates.slice(0, 5).map((c) => {
              const card = byId.get(c.cardId);
              if (!card) return null;
              return (
                <motion.div
                  key={c.cardId}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border bg-card p-2 text-xs"
                >
                  <p className="font-medium leading-snug">{truncate(card.question, 110)}</p>
                  <p className="mt-0.5 text-muted-foreground">{c.reason}</p>
                </motion.div>
              );
            })}
            {candidates.length > 5 && (
              <p className="text-center text-[10px] text-muted-foreground">
                + {candidates.length - 5} more
              </p>
            )}
          </div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
