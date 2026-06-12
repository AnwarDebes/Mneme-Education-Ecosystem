"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Filter, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { loadDeckSchedule } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

interface FeedRow {
  ts: string;
  deckId: string;
  deckName: string;
  card: ResolvedCard;
  grade: "again" | "hard" | "good" | "easy";
  interval: number;
}

export function ReviewFeedShell() {
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, ResolvedCard[]>>({});
  const [grade, setGrade] = useState<"all" | "again" | "hard" | "good" | "easy">("all");

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
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
        setCardsByDeck(map);
      })
      .catch(() => setJobs([]));
  }, []);

  const feed = useMemo<FeedRow[]>(() => {
    if (!jobs) return [];
    const out: FeedRow[] = [];
    for (const job of jobs) {
      const cards = cardsByDeck[job.id];
      if (!cards) continue;
      const sched = loadDeckSchedule(job.id);
      const byId = new Map(cards.map((c) => [c.id, c]));
      const deckName = loadDeckMeta(job.id).alias || job.filename;
      for (const cid of Object.keys(sched)) {
        const card = byId.get(cid);
        if (!card) continue;
        for (const h of sched[cid].history) {
          out.push({
            ts: h.graded_at,
            deckId: job.id,
            deckName,
            card,
            grade: h.grade,
            interval: h.interval_days,
          });
        }
      }
    }
    return out
      .filter((r) => grade === "all" || r.grade === grade)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, cardsByDeck, grade, version]);

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Review feed</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Everything you've graded</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Chronological history of every grade across every deck. The most
            recent 200 reviews; filter by grade to find patterns.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "again", "hard", "good", "easy"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={cn(
                "rounded border px-2 py-0.5 capitalize",
                grade === g ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {feed.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                Nothing graded yet. Run a study session and check back here.
              </p>
            ) : (
              <ul className="divide-y">
                {feed.map((r, i) => (
                  <motion.li
                    key={`${r.deckId}-${r.card.id}-${r.ts}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.005, 0.5) }}
                    className="flex items-start gap-3 p-3 hover:bg-secondary/30"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-medium uppercase",
                        r.grade === "easy" && "bg-success/15 text-success",
                        r.grade === "good" && "bg-primary/15 text-primary",
                        r.grade === "hard" && "bg-warn/15 text-warn",
                        r.grade === "again" && "bg-destructive/15 text-destructive",
                      )}
                    >
                      {r.grade.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{truncate(r.card.question, 140)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <Activity className="inline h-3 w-3" /> {new Date(r.ts).toLocaleString()} -{" "}
                        <Badge variant="outline" className="text-[10px]">
                          {r.deckName}
                        </Badge>{" "}
                        - interval {Math.round(r.interval)}d
                      </p>
                    </div>
                    <Link
                      href={`/decks/${r.deckId}` as any}
                      className="mt-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
