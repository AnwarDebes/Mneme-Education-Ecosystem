"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CopyCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { findDuplicateGroups } from "@/lib/duplicates";
import { toggleCardArchived } from "@/lib/deck-store";
import { useStorageVersion } from "@/lib/hooks";
import type { ResolvedCard } from "@/lib/cards";
import { truncate } from "@/lib/utils";
import { toast } from "sonner";

interface DedupPanelProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function DedupPanel({ deckId, cards }: DedupPanelProps) {
  const version = useStorageVersion();
  const [threshold, setThreshold] = useState(0.7);
  const groups = useMemo(() => {
    return findDuplicateGroups([{ deckId, deckName: "this", cards }], threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, cards, threshold, version]);

  if (groups.length === 0) return null;

  const archiveExtras = (rep: ResolvedCard, matches: ResolvedCard[]) => {
    for (const c of matches) {
      if (!c.archived) toggleCardArchived(deckId, c.id);
    }
    toast.success(`Archived ${matches.length} duplicate${matches.length === 1 ? "" : "s"} of "${truncate(rep.question, 40)}"`);
  };

  return (
    <Card className="border-warn/30 bg-warn/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <CopyCheck className="h-4 w-4 text-warn" />
            <p className="font-display text-base font-semibold">Duplicate groups in this deck</p>
            <Badge variant="outline" className="text-[10px]">
              {groups.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Threshold</span>
            <div className="w-32">
              <Slider value={[threshold]} min={0.4} max={0.95} step={0.05} onValueChange={(v) => setThreshold(v[0])} />
            </div>
            <span className="font-mono">{Math.round(threshold * 100)}%</span>
          </div>
        </div>
        <AnimatePresence>
          {groups.slice(0, 5).map((g, i) => (
            <motion.div
              key={`${g.representative.card.id}-${i}`}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-md border bg-card p-3 text-xs"
            >
              <p className="font-medium leading-snug">{truncate(g.representative.card.question, 120)}</p>
              <ul className="mt-2 space-y-1">
                {g.matches.map((m) => (
                  <li key={m.card.id} className="flex items-center justify-between gap-2 rounded border bg-secondary/30 px-2 py-1">
                    <span className="truncate">{truncate(m.card.question, 100)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(m.similarity * 100)}%
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => archiveExtras(g.representative.card, g.matches.map((m) => m.card))}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Archive duplicates
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {groups.length > 5 && (
          <p className="text-center text-[10px] text-muted-foreground">
            + {groups.length - 5} more groups
          </p>
        )}
      </CardContent>
    </Card>
  );
}
