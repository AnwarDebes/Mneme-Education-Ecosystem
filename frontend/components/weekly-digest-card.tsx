"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Award, CalendarRange, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStats, useStorageVersion } from "@/lib/hooks";
import { buildDigest, computeBests, type PersonalBests, type WeeklyDigest } from "@/lib/records";
import { cn } from "@/lib/utils";

export function WeeklyDigestCard() {
  const version = useStorageVersion();
  const stats = useStats();
  const digest = useMemo<WeeklyDigest>(() => buildDigest(stats), [stats]);
  const bests = useMemo<PersonalBests>(() => computeBests(stats), [stats]);

  if (digest.total_reviewed === 0 && bests.most_reviews_in_day.count === 0) return null;

  const trend = digest.delta_vs_prev;
  const trendUp = trend >= 0;

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">This week</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(digest.start + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} -{" "}
            {new Date(digest.end + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Reviews" value={String(digest.total_reviewed)} />
          <Tile label="Minutes" value={String(digest.total_minutes)} />
          <Tile label="Days active" value={`${digest.active_days}/7`} />
          <Tile label="Accuracy" value={`${Math.round(digest.accuracy * 100)}%`} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className={cn(
              trendUp ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend > 0 ? "+" : ""}
            {trend} vs last week
          </Badge>
          {digest.top_day.reviewed > 0 && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Best day:{" "}
              {new Date(digest.top_day.date + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short",
              })}{" "}
              ({digest.top_day.reviewed})
            </Badge>
          )}
        </div>

        <div className="space-y-1 rounded-md border bg-card p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3 w-3 text-amber-500" /> Personal bests
          </p>
          <BestRow icon={Award} label="Reviews in a day" value={bests.most_reviews_in_day.count} when={bests.most_reviews_in_day.date} />
          <BestRow icon={Award} label="Minutes in a day" value={bests.most_minutes_in_day.minutes} when={bests.most_minutes_in_day.date} />
          {bests.best_accuracy_day.total > 0 && (
            <BestRow
              icon={Award}
              label={`Accuracy (>=10 cards)`}
              value={`${Math.round(bests.best_accuracy_day.accuracy * 100)}%`}
              when={bests.best_accuracy_day.date}
            />
          )}
          <BestRow icon={Award} label="Longest streak" value={bests.longest_streak} when={null} />
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function BestRow({
  icon: Icon,
  label,
  value,
  when,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  when: string | null;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        <Icon className="inline h-3 w-3 text-amber-500" /> {label}
      </span>
      <span className="font-mono">
        {value}
        {when && (
          <span className="ml-2 text-[10px] text-muted-foreground">
            ({new Date(when + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })})
          </span>
        )}
      </span>
    </div>
  );
}
