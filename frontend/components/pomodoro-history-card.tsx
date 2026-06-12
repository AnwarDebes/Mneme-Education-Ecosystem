"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { loadPomodoroHistory } from "@/lib/pomodoro-history";
import { useStorageVersion } from "@/lib/hooks";
import { isoDate } from "@/lib/stats";

export function PomodoroHistoryCard() {
  const version = useStorageVersion();
  const history = useMemo(() => loadPomodoroHistory(), [version]);

  const byDay = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>();
    for (const e of history) {
      const day = e.ts.slice(0, 10);
      const cur = map.get(day) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += e.minutes;
      map.set(day, cur);
    }
    return map;
  }, [history]);

  const today = isoDate();
  const last30: { day: string; count: number; minutes: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = isoDate(d);
    const v = byDay.get(day) ?? { count: 0, minutes: 0 };
    last30.push({ day, ...v });
  }
  const maxCount = Math.max(1, ...last30.map((d) => d.count));
  const totalMinutes = last30.reduce((acc, d) => acc + d.minutes, 0);
  const totalCount = last30.reduce((acc, d) => acc + d.count, 0);

  if (history.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">Pomodoro history</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalCount} sessions, {totalMinutes} min, last 30 days
          </p>
        </div>
        <div className="flex h-20 items-end gap-1">
          {last30.map((d) => (
            <motion.div
              key={d.day}
              initial={{ height: 0 }}
              animate={{ height: `${(d.count / maxCount) * 100}%` }}
              transition={{ duration: 0.4 }}
              className={`w-full rounded-t ${d.day === today ? "bg-primary" : "bg-primary/40"}`}
              title={`${d.day}: ${d.count} sessions, ${d.minutes} min`}
              style={{ minHeight: d.count ? 3 : 0 }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {history
            .slice(-6)
            .reverse()
            .map((e, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })} - {e.minutes}m
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
