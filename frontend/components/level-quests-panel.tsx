"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Gift,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStorageVersion } from "@/lib/hooks";
import { claimCompleted, loadQuests, type Quest, type QuestState } from "@/lib/quests";
import { isMuted, Sounds } from "@/lib/sound";
import { loadXP, levelFromXP, levelTitle } from "@/lib/xp";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LevelQuestsPanel() {
  const version = useStorageVersion();
  const xp = useMemo(() => loadXP(), [version]);
  const info = useMemo(() => levelFromXP(xp.total), [xp]);
  const title = levelTitle(info.level);
  const [quests, setQuests] = useState<QuestState | null>(null);

  useEffect(() => {
    setQuests(loadQuests());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const claimAll = () => {
    const result = claimCompleted();
    if (result.claimed === 0) {
      toast.info("Nothing ready to claim yet");
      return;
    }
    toast.success(`+${result.xp_total} XP - ${result.names.join(", ")}`);
    if (!isMuted()) Sounds.complete();
    fireConfetti({ particles: 80, durationMs: 2200 });
  };

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <Card className="overflow-hidden">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/40"
            >
              <Star className="h-7 w-7 text-violet-500" />
            </motion.div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {title}
              </p>
              <p className="font-display text-3xl font-semibold leading-none">
                Lvl {info.level}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{info.total} XP</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{info.in_level} in level</span>
              <span>{info.to_next} to next</span>
            </div>
            <Progress value={info.pct_to_next} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold">Daily quests</p>
              <Badge variant="outline" className="text-[10px]">
                resets at midnight
              </Badge>
            </div>
            {quests && quests.quests.some((q) => completable(q, quests)) && (
              <Button size="sm" onClick={claimAll}>
                <Sparkles className="h-3.5 w-3.5" /> Claim rewards
              </Button>
            )}
          </div>
          {quests ? (
            <ul className="space-y-2">
              <AnimatePresence>
                {quests.quests.map((q, i) => (
                  <QuestRow key={q.id} q={q} state={quests} delay={i * 0.05} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Loading quests...</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function completable(q: Quest, state: QuestState): boolean {
  if (state.claimed.includes(q.id)) return false;
  return (state.progress[q.id] ?? 0) >= q.target;
}

function QuestRow({ q, state, delay }: { q: Quest; state: QuestState; delay: number }) {
  const progress = state.progress[q.id] ?? 0;
  const claimed = state.claimed.includes(q.id);
  const ready = progress >= q.target;
  const pct = Math.min(100, Math.round((progress / q.target) * 100));
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "rounded-lg border p-3 text-sm transition-colors",
        claimed && "border-success/40 bg-success/5",
        ready && !claimed && "border-amber-400/60 bg-amber-100/30 dark:bg-amber-500/10",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{q.title}</p>
          <p className="text-xs text-muted-foreground">{q.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          {claimed ? (
            <Badge variant="outline" className="border-success/60 text-success">
              <CheckCircle2 className="h-3 w-3" /> claimed
            </Badge>
          ) : ready ? (
            <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-300">
              <Trophy className="h-3 w-3" /> ready
            </Badge>
          ) : (
            <span className="text-muted-foreground">
              {progress}/{q.target}
            </span>
          )}
          <Badge variant="outline" className="border-violet-400/60 text-violet-600 dark:text-violet-300">
            +{q.reward_xp} XP
          </Badge>
        </div>
      </div>
      <Progress value={pct} className="mt-2 h-1.5" />
    </motion.li>
  );
}
