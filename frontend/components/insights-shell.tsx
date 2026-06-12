"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Flame,
  Hash,
  Loader2,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarForecast } from "@/components/calendar-forecast";
import { ForgettingCurve } from "@/components/forgetting-curve";
import { GlobalConceptMap } from "@/components/global-concept-map";
import { HeatmapCalendar } from "@/components/heatmap-calendar";
import { HourAnalyzer } from "@/components/hour-analyzer";
import { LearnerProfileCard } from "@/components/learner-profile-card";
import { LevelQuestsPanel } from "@/components/level-quests-panel";
import { LongitudinalCard } from "@/components/longitudinal-card";
import { PomodoroHistoryCard } from "@/components/pomodoro-history-card";
import { StreakBadge } from "@/components/streak-badge";
import { WeeklyDigestCard } from "@/components/weekly-digest-card";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { getCardSchedule } from "@/lib/schedule";
import { useStats, useStorageVersion } from "@/lib/hooks";
import { lastNDays } from "@/lib/stats";
import { loadTagStats, tagAccuracy, type TagBucket } from "@/lib/tag-stats";
import { cn } from "@/lib/utils";
import type { JobSummary } from "@/lib/types";

interface DeckData {
  job: JobSummary;
  cards: ResolvedCard[];
}

export function InsightsShell() {
  const stats = useStats();
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [decks, setDecks] = useState<Record<string, ResolvedCard[]>>({});
  const [tags, setTags] = useState<Record<string, TagBucket>>({});

  useEffect(() => {
    setTags(loadTagStats());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const map: Record<string, ResolvedCard[]> = {};
        await Promise.all(
          done.slice(0, 30).map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              map[j.id] = resolveDeck(j.id, d.cards);
            } catch {
              map[j.id] = [];
            }
          }),
        );
        setDecks(map);
      })
      .catch(() => setJobs([]));
  }, []);

  const week = useMemo(() => lastNDays(stats, 7), [stats]);
  const last30 = useMemo(() => lastNDays(stats, 30), [stats]);
  const weekTotal = week.reduce((a, d) => a + d.reviewed, 0);
  const monthTotal = last30.reduce((a, d) => a + d.reviewed, 0);
  const peakDay = useMemo(() => {
    let best = { date: "", count: 0 };
    for (const day of last30) {
      if (day.reviewed > best.count) best = { date: day.date, count: day.reviewed };
    }
    return best;
  }, [last30]);

  const accuracyRecent = useMemo(() => {
    const sum = last30.reduce(
      (acc, d) => ({
        right: acc.right + d.good + d.easy,
        partial: acc.partial + d.hard,
        wrong: acc.wrong + d.again,
      }),
      { right: 0, partial: 0, wrong: 0 },
    );
    const total = sum.right + sum.partial + sum.wrong;
    if (!total) return null;
    return Math.round(((sum.right + sum.partial * 0.5) / total) * 100);
  }, [last30]);

  const hardestCards = useMemo<{ deck: JobSummary; card: ResolvedCard; lapses: number; ease: number }[]>(() => {
    if (!jobs) return [];
    const out: { deck: JobSummary; card: ResolvedCard; lapses: number; ease: number }[] = [];
    for (const job of jobs) {
      const cards = decks[job.id];
      if (!cards) continue;
      for (const card of cards) {
        const s = getCardSchedule(job.id, card.id);
        if (s.lapses === 0 && s.reps === 0) continue;
        out.push({ deck: job, card, lapses: s.lapses, ease: s.ease });
      }
    }
    return out
      .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, decks, version]);

  const tagRows = useMemo(() => {
    const entries = Object.entries(tags).map(([tag, bucket]) => ({
      tag,
      bucket,
      ...tagAccuracy(bucket),
    }));
    return entries
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [tags]);

  const cardsByDeck = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [id, cards] of Object.entries(decks)) out[id] = cards.map((c) => c.id);
    return out;
  }, [decks]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weekMax = Math.max(1, ...week.map((d) => d.reviewed));

  return (
    <div className="container py-10">
      <div className="space-y-8">
        <header className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Insights</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Where you stand, what to fix.
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Automatic weekly report card. Built from the grades you've logged across every deck and every mode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StreakBadge streak={stats.current_streak} longest={stats.longest_streak} size="lg" />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigTile
            label="This week"
            value={`${weekTotal}`}
            hint={`${monthTotal} in last 30 days`}
            icon={Activity}
            tone="primary"
          />
          <BigTile
            label="Accuracy (30d)"
            value={accuracyRecent != null ? `${accuracyRecent}%` : "-"}
            hint={accuracyRecent != null ? "Good + easy + 0.5*hard" : "No graded sessions yet"}
            icon={Target}
            tone="success"
          />
          <BigTile
            label="Current streak"
            value={`${stats.current_streak}`}
            hint={`Longest ${stats.longest_streak}`}
            icon={Flame}
            tone="warn"
          />
          <BigTile
            label="Achievements"
            value={`${stats.unlocked.length}`}
            hint="See library"
            icon={Trophy}
            tone="violet"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">This week's reviews</CardTitle>
              <CardDescription>
                Peak day{" "}
                {peakDay.date
                  ? new Date(peakDay.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                  : "-"}{" "}
                with {peakDay.count} cards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-2">
                {week.map((d, i) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.reviewed / weekMax) * 100}%` }}
                        transition={{ delay: i * 0.04 }}
                        className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60"
                        style={{ minHeight: d.reviewed ? 3 : 0 }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: "narrow" })}
                    </span>
                    <span className="text-[10px] font-medium">{d.reviewed}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <HeatmapCalendar stats={stats} />
        </section>

        <CalendarForecast jobs={jobs} cardsByDeck={cardsByDeck} />

        <ForgettingCurve jobs={jobs} />

        <HourAnalyzer />

        <PomodoroHistoryCard />

        <WeeklyDigestCard />

        <LongitudinalCard />

        <LearnerProfileCard />

        <GlobalConceptMap />

        <LevelQuestsPanel />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">Topic accuracy</h2>
            </div>
            <p className="text-xs text-muted-foreground">{tagRows.length} tags</p>
          </div>
          {tagRows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                Grade some cards to see per-tag accuracy. Each grade you give in any mode
                feeds this dashboard.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-2 p-4">
                {tagRows.map((row) => (
                  <TagRow key={row.tag} {...row} />
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">Hardest cards</h2>
            </div>
          </div>
          {hardestCards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                No lapses yet. Try a Cram session to surface the trickier ones.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {hardestCards.map(({ deck, card, lapses, ease }) => {
                  const meta = loadDeckMeta(deck.id);
                  return (
                    <Link
                      key={card.id}
                      href={`/decks/${deck.id}?focus=${card.id}` as any}
                      className="flex items-start gap-3 p-4 hover:bg-secondary/40"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{card.question}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {card.answer}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {meta.alias || deck.filename}
                          </Badge>
                          <span>{lapses} lapses</span>
                          <span>- ease {ease.toFixed(2)}</span>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10">
            <CardContent className="grid items-center gap-4 p-6 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-display text-xl font-semibold">
                  Use the insights, not just admire them.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The weakest tags above are your best study targets. Open a
                  deck, filter by that tag, and run a Cram or Test session.
                </p>
              </div>
              <Button asChild>
                <Link href={"/today" as any}>
                  Today's queue <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function BigTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warn" | "violet";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warn: "text-orange-500",
    violet: "text-violet-500",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function TagRow({
  tag,
  bucket,
  total,
  pct,
}: {
  tag: string;
  bucket: TagBucket;
  total: number;
  pct: number;
}) {
  const percent = Math.round(pct * 100);
  const tone =
    pct >= 0.8
      ? "bg-success"
      : pct >= 0.6
      ? "bg-warn"
      : "bg-destructive";
  return (
    <div className="grid items-center gap-2 md:grid-cols-[160px_1fr_auto]">
      <p className="truncate font-medium">#{tag}</p>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{percent}%</span>
        <Badge variant="outline" className="text-[10px]">
          {total}
        </Badge>
        <span className="hidden sm:inline">
          <TrendingUp className="inline h-3 w-3" /> {bucket.again}/{bucket.hard}/{bucket.good}/{bucket.easy}
        </span>
      </div>
    </div>
  );
}
