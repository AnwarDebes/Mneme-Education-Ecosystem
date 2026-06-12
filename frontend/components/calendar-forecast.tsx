"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { JobSummary } from "@/lib/types";
import { loadDeckSchedule } from "@/lib/schedule";
import { isoDate } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface ForecastProps {
  jobs: JobSummary[];
  cardsByDeck: Record<string, string[]>;
  days?: number;
  className?: string;
}

function bucket(n: number): number {
  if (n <= 0) return 0;
  if (n < 5) return 1;
  if (n < 15) return 2;
  if (n < 35) return 3;
  return 4;
}

const BUCKETS = [
  "bg-muted/60 dark:bg-muted/30",
  "bg-violet-200 dark:bg-violet-900/60",
  "bg-violet-300 dark:bg-violet-700/80",
  "bg-violet-400 dark:bg-violet-500",
  "bg-violet-500 dark:bg-violet-400",
];

export function CalendarForecast({
  jobs,
  cardsByDeck,
  days = 30,
  className,
}: ForecastProps) {
  const grid = useMemo(() => {
    const totals: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      totals[isoDate(d)] = 0;
    }
    for (const job of jobs) {
      const cards = cardsByDeck[job.id] ?? [];
      const sched = loadDeckSchedule(job.id);
      const now = Date.now();
      const horizon = now + days * 86400000;
      for (const cardId of cards) {
        const s = sched[cardId];
        if (!s) {
          // Never seen = due today.
          const key = isoDate(today);
          totals[key] = (totals[key] ?? 0) + 1;
          continue;
        }
        const due = new Date(s.due_at).getTime();
        if (due <= now) {
          const key = isoDate(today);
          totals[key] = (totals[key] ?? 0) + 1;
          continue;
        }
        if (due > horizon) continue;
        const dueDate = new Date(s.due_at);
        dueDate.setHours(0, 0, 0, 0);
        const key = isoDate(dueDate);
        totals[key] = (totals[key] ?? 0) + 1;
      }
    }
    const cells: { date: string; count: number; weekday: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const k = isoDate(d);
      cells.push({ date: k, count: totals[k] ?? 0, weekday: d.getDay() });
    }
    return cells;
  }, [jobs, cardsByDeck, days]);

  const peak = grid.reduce((acc, c) => Math.max(acc, c.count), 0);
  const total = grid.reduce((acc, c) => acc + c.count, 0);

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">
              Forecast - next {days} days
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {total} reviews coming, peak {peak} in a day
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px]">
          {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
            <p key={d} className="text-center text-muted-foreground">
              {d}
            </p>
          ))}
          {Array.from({ length: grid[0]?.weekday ?? 0 }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {grid.map((c, i) => {
            const d = new Date(c.date);
            const day = d.getDate();
            return (
              <motion.div
                key={c.date}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5), duration: 0.2 }}
                title={`${c.date}: ${c.count} due`}
                className={cn(
                  "relative aspect-square rounded-md ring-1 ring-inset ring-border/60",
                  BUCKETS[bucket(c.count)],
                )}
              >
                <span className="absolute left-1 top-0.5 text-[9px] text-muted-foreground">{day}</span>
                {c.count > 0 && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-semibold">
                    {c.count}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Quiet</span>
          {BUCKETS.map((c, i) => (
            <span key={i} className={cn("h-3 w-3 rounded-sm", c)} />
          ))}
          <span>Heavy</span>
        </div>
      </CardContent>
    </Card>
  );
}
