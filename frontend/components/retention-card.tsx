"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStorageVersion } from "@/lib/hooks";
import { deckRetention } from "@/lib/retention";
import { cn } from "@/lib/utils";

interface RetentionCardProps {
  deckId: string;
  cardIds: string[];
}

export function RetentionCard({ deckId, cardIds }: RetentionCardProps) {
  const version = useStorageVersion();
  const stats = useMemo(() => deckRetention(deckId, cardIds), [deckId, cardIds, version]);

  if (stats.total === 0) return null;
  const seen = stats.total - stats.by_band.unseen;
  if (seen === 0) return null;

  const bands = [
    { label: "Strong (>=90%)", count: stats.by_band.p100_90, color: "bg-success" },
    { label: "Good (75-90%)", count: stats.by_band.p90_75, color: "bg-primary" },
    { label: "Shaky (50-75%)", count: stats.by_band.p75_50, color: "bg-warn" },
    { label: "Fragile (<50%)", count: stats.by_band.below_50, color: "bg-destructive" },
    { label: "Unseen", count: stats.by_band.unseen, color: "bg-muted" },
  ];

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">Predicted retention</p>
          </div>
          <p className="text-xs text-muted-foreground">
            mean {Math.round(stats.mean * 100)}% - median {Math.round(stats.median * 100)}%
          </p>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-border">
          {bands.map((b) => {
            const w = stats.total ? (b.count / stats.total) * 100 : 0;
            if (w === 0) return null;
            return (
              <motion.div
                key={b.label}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ duration: 0.5 }}
                className={cn("h-full", b.color)}
                title={`${b.label}: ${b.count}`}
              />
            );
          })}
        </div>
        <ul className="grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-5">
          {bands.map((b) => (
            <li key={b.label} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", b.color)} />
              <span className="truncate">
                {b.label}: <span className="font-semibold">{b.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
