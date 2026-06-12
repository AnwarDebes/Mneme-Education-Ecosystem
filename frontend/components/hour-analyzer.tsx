"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { hourlyBuckets, loadTimings, modeBuckets } from "@/lib/timing";
import { useStorageVersion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function HourAnalyzer() {
  const version = useStorageVersion();
  const events = useMemo(() => loadTimings(), [version]);
  const buckets = useMemo(() => hourlyBuckets(events), [events]);
  const modes = useMemo(() => modeBuckets(events), [events]);

  const maxReviews = Math.max(1, ...buckets.map((b) => b.reviews));
  const peak = buckets.reduce<typeof buckets[number] | null>((best, b) => {
    if (b.reviews < 3) return best;
    if (!best || b.accuracy > best.accuracy) return b;
    return best;
  }, null);

  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Once you've graded a few cards across different times of day, this panel
          shows your best hour for accuracy and speed.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">When you do best</p>
          </div>
          {peak && (
            <p className="text-xs text-muted-foreground">
              Best hour: {String(peak.hour).padStart(2, "0")}:00 -{" "}
              {Math.round(peak.accuracy * 100)}% accuracy
            </p>
          )}
        </div>
        <div className="flex items-end gap-0.5">
          {buckets.map((b) => {
            const bg =
              b.reviews === 0
                ? "bg-muted/40"
                : b.accuracy >= 0.8
                ? "bg-success"
                : b.accuracy >= 0.6
                ? "bg-warn"
                : "bg-destructive";
            const height = b.reviews === 0 ? 6 : 12 + (b.reviews / maxReviews) * 40;
            return (
              <div key={b.hour} className="flex flex-1 flex-col items-center">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.4, delay: b.hour * 0.01 }}
                  className={cn("w-full rounded-sm", bg)}
                  title={`${String(b.hour).padStart(2, "0")}:00 - ${Math.round(b.accuracy * 100)}% acc, ${b.reviews} reviews`}
                />
                {b.hour % 6 === 0 && (
                  <span className="mt-1 text-[9px] text-muted-foreground">
                    {String(b.hour).padStart(2, "0")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {modes
            .sort((a, b) => b.reviews - a.reviews)
            .map((m) => (
              <div key={m.mode} className="rounded-md border bg-secondary/30 p-2 text-xs">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold capitalize">{m.mode}</p>
                  <span className="text-muted-foreground">{m.reviews}</span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  <span>acc {Math.round(m.accuracy * 100)}%</span>
                  <span>avg {Math.round(m.avg_ms / 1000)}s</span>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
