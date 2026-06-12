"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldCheck, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deckQualityReport } from "@/lib/card-quality";
import type { ResolvedCard } from "@/lib/cards";
import { useStorageVersion } from "@/lib/hooks";
import { truncate } from "@/lib/utils";

interface CardQualityPanelProps {
  cards: ResolvedCard[];
  onPickWeak?: (card: ResolvedCard) => void;
}

export function CardQualityPanel({ cards, onPickWeak }: CardQualityPanelProps) {
  const version = useStorageVersion();
  const report = useMemo(() => deckQualityReport(cards), [cards, version]);

  if (cards.length === 0) return null;

  const tone =
    report.avg >= 85
      ? "border-success/30 bg-success/5 text-success"
      : report.avg >= 65
      ? "border-primary/30 bg-primary/5 text-primary"
      : "border-warn/30 bg-warn/5 text-warn";

  return (
    <Card className={tone}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <p className="font-display text-base font-semibold">Card quality</p>
            <Badge variant="outline">{report.avg}/100</Badge>
          </div>
          {report.weak.length === 0 && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> clean
            </span>
          )}
        </div>
        {report.weak.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All cards score 70+. Quality looks healthy.
          </p>
        ) : (
          <AnimatePresence>
            <p className="text-xs text-muted-foreground">
              {report.weak.length} card{report.weak.length === 1 ? "" : "s"} score
              below 70. Common issues: too short answer, no question mark, Q == A.
            </p>
            {report.weak.map((w) => (
              <motion.div
                key={w.card.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start justify-between gap-2 rounded-md border bg-card p-2 text-xs"
              >
                <div className="min-w-0">
                  <Badge variant="outline" className="text-[10px]">
                    {w.score}/100
                  </Badge>
                  <p className="mt-0.5 font-medium">{truncate(w.card.question, 100)}</p>
                  <p className="text-muted-foreground">{truncate(w.card.answer, 100)}</p>
                </div>
                {onPickWeak && (
                  <Button size="sm" variant="ghost" onClick={() => onPickWeak(w.card)}>
                    <Wand2 className="h-3.5 w-3.5" /> Fix
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
