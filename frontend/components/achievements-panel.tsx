"use client";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ACHIEVEMENTS, tierColor, type Achievement } from "@/lib/achievements";
import { useStats } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function AchievementsPanel() {
  const stats = useStats();
  const unlocked = new Set(stats.unlocked);
  ACHIEVEMENTS.forEach((a) => {
    if (a.check(stats)) unlocked.add(a.id);
  });
  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Achievements</h2>
        <p className="text-xs text-muted-foreground">
          {done} / {total} unlocked
        </p>
      </div>
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {ACHIEVEMENTS.map((ach) => (
            <AchievementBadge key={ach.id} ach={ach} unlocked={unlocked.has(ach.id)} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function AchievementBadge({ ach, unlocked }: { ach: Achievement; unlocked: boolean }) {
  const Icon = ach.icon;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "group relative flex aspect-square cursor-help flex-col items-center justify-center rounded-xl border p-2 text-center transition-all",
              unlocked
                ? cn("bg-gradient-to-br ring-1 ring-inset", tierColor(ach.tier))
                : "bg-muted/40 text-muted-foreground/60",
            )}
          >
            {unlocked ? (
              <Icon className="h-6 w-6" />
            ) : (
              <Lock className="h-5 w-5 opacity-60" />
            )}
            <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight">{ach.name}</p>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{ach.name}</p>
          <p className="text-muted-foreground">{ach.description}</p>
          {!unlocked && <p className="mt-1 text-muted-foreground opacity-60">Locked</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
