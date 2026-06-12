"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Flame,
  Loader2,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DailyChallenge } from "@/components/daily-challenge";
import { JournalCard } from "@/components/journal-card";
import { SessionGoalWidget } from "@/components/session-goal-widget";
import { StreakBadge } from "@/components/streak-badge";
import { StreakFreezeCard } from "@/components/streak-freeze-card";
import { VacationToggle } from "@/components/vacation-toggle";
import { jobDetail, listJobs } from "@/lib/api";
import { loadDeckMeta } from "@/lib/deck-store";
import { dueCardIds, getCardSchedule } from "@/lib/schedule";
import { useStats, useStorageVersion } from "@/lib/hooks";
import { isoDate } from "@/lib/stats";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import type { JobSummary } from "@/lib/types";

interface DeckDue {
  deck: JobSummary;
  total: number;
  due: number;
  lapses: number;
  alias: string;
}

const GOAL_DEFAULT = 20;

export function TodayShell() {
  const router = useRouter();
  const stats = useStats();
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, string[]>>({});

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const map: Record<string, string[]> = {};
        await Promise.all(
          done.slice(0, 30).map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              map[j.id] = d.cards.map((c) => c.id);
            } catch {
              map[j.id] = [];
            }
          }),
        );
        setCardsByDeck(map);
      })
      .catch(() => setJobs([]));
  }, []);

  const dueByDeck = useMemo<DeckDue[]>(() => {
    if (!jobs) return [];
    return jobs
      .map((j) => {
        const cards = cardsByDeck[j.id] ?? [];
        const due = dueCardIds(j.id, cards).length;
        const lapses = cards.reduce(
          (acc, id) => acc + getCardSchedule(j.id, id).lapses,
          0,
        );
        const alias = loadDeckMeta(j.id).alias || j.filename;
        return { deck: j, total: cards.length, due, lapses, alias };
      })
      .filter((d) => d.due > 0)
      .sort((a, b) => b.due - a.due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, cardsByDeck, version]);

  const totalDue = dueByDeck.reduce((acc, d) => acc + d.due, 0);
  const todayKey = isoDate();
  const todayCount = stats.daily[todayKey]?.reviewed ?? 0;
  const goal = GOAL_DEFAULT;
  const goalPct = Math.min(100, Math.round((todayCount / goal) * 100));

  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    if (totalDue === 0 && (jobs?.length ?? 0) > 0 && !celebrated) {
      setCelebrated(true);
      fireConfetti({ particles: 60, durationMs: 1800 });
    }
  }, [totalDue, jobs, celebrated]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="space-y-8">
        <header className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Your review queue
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Smart aggregation of every card that's due across every deck. Knock these out today to keep your streak alive.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <VacationToggle />
            <StreakBadge streak={stats.current_streak} longest={stats.longest_streak} size="lg" />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <BigStat
            icon={Sparkles}
            value={String(totalDue)}
            label="cards due now"
            tone="primary"
          />
          <BigStat
            icon={Target}
            value={`${todayCount} / ${goal}`}
            label={`${goalPct}% of daily goal`}
            tone="success"
            extra={<Progress value={goalPct} className="mt-3 h-1.5" />}
          />
          <BigStat
            icon={Flame}
            value={String(stats.current_streak)}
            label={`day streak (longest ${stats.longest_streak})`}
            tone="warn"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SessionGoalWidget />
          <StreakFreezeCard />
        </div>

        <DailyChallenge />

        <JournalCard />

        {totalDue === 0 ? <EmptyCelebration jobs={jobs} /> : <DueList items={dueByDeck} onStart={(deckId) => router.push(`/study?job=${deckId}&mode=cram` as any)} />}

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display text-lg font-semibold">How due-dates work</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Each time you grade a card, mneme schedules its next review using a
                simple SM-2-style algorithm. Cards become due when the interval elapses.
                Cram mode here studies only the due ones, oldest first.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/about#progress">
                Learn more <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BigStat({
  icon: Icon,
  value,
  label,
  tone,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  tone: "primary" | "success" | "warn";
  extra?: React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-success"
      : "text-orange-500";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <p className="mt-1 font-display text-4xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {extra}
      </CardContent>
    </Card>
  );
}

function DueList({ items, onStart }: { items: DeckDue[]; onStart: (deckId: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Decks with due cards</h2>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      <AnimatePresence>
        <div className="grid gap-3">
          {items.map((d) => (
            <motion.div
              key={d.deck.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <Card className="group hover:border-primary/40">
                <CardContent className="grid grid-cols-1 items-center gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
                  <div className="min-w-0">
                    <Link
                      href={`/decks/${d.deck.id}` as any}
                      className="truncate font-display text-lg font-semibold hover:underline"
                    >
                      {d.alias}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{d.total} cards</Badge>
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        {d.due} due
                      </Badge>
                      {d.lapses > 0 && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          {d.lapses} lapses
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-40">
                    <Progress
                      value={d.total ? Math.round(((d.total - d.due) / d.total) * 100) : 0}
                      className="h-2"
                    />
                  </div>
                  <Button onClick={() => onStart(d.deck.id)} size="sm">
                    <Play className="h-4 w-4" /> Cram now
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </section>
  );
}

function EmptyCelebration({ jobs }: { jobs: JobSummary[] }) {
  const hasAnyDeck = jobs.length > 0;
  return (
    <Card className="border-success/40 bg-gradient-to-br from-success/10 via-emerald-400/5 to-teal-400/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <CheckCircle2 className="h-5 w-5 text-success" />
          {hasAnyDeck ? "All caught up." : "No decks yet"}
        </CardTitle>
        <CardDescription>
          {hasAnyDeck
            ? "Nothing is due right now. Review a deck for fun, or generate a new one."
            : "Generate a deck to get started. Your review queue lives here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/generator">
            <Sparkles className="h-4 w-4" /> Generate a deck
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={"/library" as any}>Open the library</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/study">
            <CalendarDays className="h-4 w-4" /> Pick a deck to study
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
