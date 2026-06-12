"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, GitCompare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { deckScheduleStats } from "@/lib/schedule";
import { deckRetention } from "@/lib/retention";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeckCompareShell() {
  const params = useSearchParams();
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cards, setCards] = useState<Record<string, ResolvedCard[]>>({});
  const [aId, setAId] = useState<string>(params.get("a") || "");
  const [bId, setBId] = useState<string>(params.get("b") || "");

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        if (!aId && done[0]) setAId(done[0].id);
        if (!bId && done[1]) setBId(done[1].id);
        const map: Record<string, ResolvedCard[]> = {};
        await Promise.all(
          done.map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              map[j.id] = resolveDeck(j.id, d.cards);
            } catch {
              map[j.id] = [];
            }
          }),
        );
        setCards(map);
      })
      .catch(() => setJobs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compute = (deckId: string) => {
    const list = cards[deckId] ?? [];
    const ids = list.map((c) => c.id);
    const sched = deckScheduleStats(deckId, ids);
    const ret = deckRetention(deckId, ids);
    return {
      total: list.length,
      mastered: sched.mastered,
      learned: sched.learned,
      due_now: sched.due_now,
      lapses: sched.lapses,
      avg_ease: sched.avg_ease,
      retention_mean: ret.mean,
    };
  };

  const a = useMemo(() => (aId ? compute(aId) : null), [aId, cards, version]);
  const b = useMemo(() => (bId ? compute(bId) : null), [bId, cards, version]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="space-y-5">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Compare</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Deck vs deck
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Pick two decks. See which you've engaged with more, which you've
            mastered more, and which is fragile in memory.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <DeckPicker label="Deck A" value={aId} onChange={setAId} jobs={jobs} />
          <div className="flex items-center justify-center">
            <GitCompare className="h-5 w-5 text-muted-foreground" />
          </div>
          <DeckPicker label="Deck B" value={bId} onChange={setBId} jobs={jobs} />
        </div>

        {a && b && (
          <div className="grid gap-4 md:grid-cols-2">
            <DeckSide deckId={aId} jobs={jobs} stats={a} other={b} />
            <DeckSide deckId={bId} jobs={jobs} stats={b} other={a} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeckPicker({
  label,
  value,
  onChange,
  jobs,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  jobs: JobSummary[];
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a deck" />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((j) => {
              const m = loadDeckMeta(j.id);
              return (
                <SelectItem key={j.id} value={j.id}>
                  {m.alias || j.filename}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

interface SideStats {
  total: number;
  mastered: number;
  learned: number;
  due_now: number;
  lapses: number;
  avg_ease: number;
  retention_mean: number;
}

function DeckSide({
  deckId,
  jobs,
  stats,
  other,
}: {
  deckId: string;
  jobs: JobSummary[];
  stats: SideStats;
  other: SideStats;
}) {
  const job = jobs.find((j) => j.id === deckId);
  const name = job ? loadDeckMeta(job.id).alias || job.filename : deckId;
  const masteryPct = stats.total ? stats.mastered / stats.total : 0;
  const otherMastery = other.total ? other.mastered / other.total : 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center justify-between">
            <span>{name}</span>
            <Link href={`/decks/${deckId}` as any} className="text-xs text-primary">
              open <ArrowRight className="inline h-3 w-3" />
            </Link>
          </CardTitle>
          <CardDescription>{stats.total} cards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Mastered" value={`${stats.mastered}`} delta={masteryPct - otherMastery} pct />
          <Row label="Learned" value={`${stats.learned}`} delta={stats.learned - other.learned} />
          <Row label="Due now" value={`${stats.due_now}`} delta={stats.due_now - other.due_now} invert />
          <Row label="Lapses" value={`${stats.lapses}`} delta={stats.lapses - other.lapses} invert />
          <Row label="Avg ease" value={stats.avg_ease.toFixed(2)} delta={stats.avg_ease - other.avg_ease} />
          <Row
            label="Retention (mean)"
            value={`${Math.round(stats.retention_mean * 100)}%`}
            delta={stats.retention_mean - other.retention_mean}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Row({
  label,
  value,
  delta,
  invert,
  pct,
}: {
  label: string;
  value: string;
  delta: number;
  invert?: boolean;
  pct?: boolean;
}) {
  const good = invert ? delta < 0 : delta > 0;
  const tone = delta === 0 ? "text-muted-foreground" : good ? "text-success" : "text-destructive";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono">{value}</span>
        <Badge variant="outline" className={cn("text-[10px]", tone)}>
          {delta > 0 ? "+" : ""}
          {pct ? `${(delta * 100).toFixed(1)}%` : delta.toFixed(2)}
        </Badge>
      </span>
    </div>
  );
}
