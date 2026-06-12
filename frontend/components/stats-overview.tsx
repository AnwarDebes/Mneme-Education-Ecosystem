"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, Flame, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StreakBadge } from "@/components/streak-badge";
import { HeatmapCalendar } from "@/components/heatmap-calendar";
import { useMounted, useStats } from "@/lib/hooks";
import { lastNDays, isoDate } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface StatsOverviewProps {
  deckCount?: number;
  className?: string;
  compact?: boolean;
}

export function StatsOverview({ deckCount, className, compact }: StatsOverviewProps) {
  const mounted = useMounted();
  const stats = useStats();

  const todayCount = useMemo(() => {
    const today = isoDate();
    return stats.daily[today]?.reviewed ?? 0;
  }, [stats]);

  const weekCount = useMemo(() => {
    return lastNDays(stats, 7).reduce((a, d) => a + d.reviewed, 0);
  }, [stats]);

  const dailyGoal = 20;
  const goalProgress = Math.min(100, Math.round((todayCount / dailyGoal) * 100));

  if (!mounted) {
    return <div className={cn("h-32", className)} aria-hidden />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("grid gap-4", compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <StatTile
          icon={Flame}
          label="Current streak"
          value={`${stats.current_streak}`}
          hint={`Longest: ${stats.longest_streak} days`}
          accent="text-orange-500"
        />
        <StatTile
          icon={Sparkles}
          label="Reviews today"
          value={`${todayCount}`}
          hint={`Goal: ${dailyGoal} cards`}
          accent="text-primary"
          extra={
            <div className="mt-2 space-y-1">
              <Progress value={goalProgress} className="h-1.5" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {goalProgress}% of daily goal
              </p>
            </div>
          }
        />
        <StatTile
          icon={Target}
          label="This week"
          value={`${weekCount}`}
          hint={`${stats.total_reviewed} all-time`}
          accent="text-success"
        />
        {compact ? null : (
          <StatTile
            icon={Clock}
            label="Minutes studied"
            value={`${Math.round(stats.total_minutes)}`}
            hint={deckCount != null ? `${deckCount} decks` : `${stats.unlocked.length} achievements`}
            accent="text-accent-foreground"
          />
        )}
        {compact && deckCount != null ? (
          <StatTile
            icon={BookOpen}
            label="Decks"
            value={`${deckCount}`}
            hint={`${stats.unlocked.length} achievements unlocked`}
            accent="text-violet-500"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <StreakBadge streak={stats.current_streak} longest={stats.longest_streak} />
        <p className="text-xs text-muted-foreground">
          Studied {Object.keys(stats.daily).length} different days.
        </p>
      </div>
      {!compact && <HeatmapCalendar stats={stats} />}
    </div>
  );
}

interface StatTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: string;
  extra?: React.ReactNode;
}

function StatTile({ icon: Icon, label, value, hint, accent, extra }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="relative overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <Icon className={cn("h-4 w-4", accent)} />
          </div>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {extra}
        </CardContent>
      </Card>
    </motion.div>
  );
}
