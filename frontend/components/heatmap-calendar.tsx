"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GlobalStats } from "@/lib/stats";
import { isoDate } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface HeatmapProps {
  stats: GlobalStats;
  days?: number;
  className?: string;
}

function bucket(count: number): number {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 35) return 3;
  return 4;
}

const BUCKET_CLASSES = [
  "bg-muted/70 dark:bg-muted/40",
  "bg-emerald-200 dark:bg-emerald-900/60",
  "bg-emerald-300 dark:bg-emerald-700/80",
  "bg-emerald-400 dark:bg-emerald-500",
  "bg-emerald-500 dark:bg-emerald-400",
];

export function HeatmapCalendar({ stats, days = 91, className }: HeatmapProps) {
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const offset = 6 - dayOfWeek;
    const last = new Date(today);
    last.setDate(last.getDate() + offset);
    const first = new Date(last);
    first.setDate(first.getDate() - days + 1);

    const cells: { date: string; count: number; minutes: number }[] = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const key = isoDate(d);
      const entry = stats.daily[key];
      cells.push({ date: key, count: entry?.reviewed ?? 0, minutes: entry?.minutes ?? 0 });
    }

    const columns: { date: string; count: number; minutes: number }[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      columns.push(cells.slice(i, i + 7));
    }
    return { columns, first, last };
  }, [stats, days]);

  const totalReviewed = useMemo(
    () => grid.columns.flat().reduce((acc, c) => acc + c.count, 0),
    [grid],
  );

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Activity</h3>
        <p className="text-xs text-muted-foreground">
          {totalReviewed} reviews in the last {days} days
        </p>
      </div>
      <div className="mt-3 flex gap-1">
        {grid.columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((cell) => (
              <motion.span
                key={cell.date}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18 }}
                title={`${cell.date}: ${cell.count} reviews`}
                className={cn(
                  "h-3 w-3 rounded-[3px] ring-1 ring-inset ring-border",
                  BUCKET_CLASSES[bucket(cell.count)],
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Less</span>
        {BUCKET_CLASSES.map((c, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-[3px]", c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
