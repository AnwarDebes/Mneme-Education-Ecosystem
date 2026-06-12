"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Lock, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { jobDetail, listJobs } from "@/lib/api";
import { loadCollections, type Collection } from "@/lib/collections";
import { loadCourse } from "@/lib/course";
import { loadDeckMeta } from "@/lib/deck-store";
import { deckScheduleStats } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

interface SkillTreeProps {
  collectionId: string;
}

interface Node {
  deck: JobSummary;
  mastered_pct: number;
  unlocked: boolean;
  completed: boolean;
  target: number;
  goal: string;
}

export function SkillTree({ collectionId }: SkillTreeProps) {
  const version = useStorageVersion();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setCollection(loadCollections().find((c) => c.id === collectionId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, version]);

  useEffect(() => {
    listJobs().then(async (js) => {
      const done = js.filter((j) => j.status === "done");
      setJobs(done);
      const map: Record<string, string[]> = {};
      await Promise.all(
        done.map(async (j) => {
          try {
            const d = await jobDetail(j.id);
            map[j.id] = d.cards.map((c) => c.id);
          } catch {
            map[j.id] = [];
          }
        }),
      );
      setCardsByDeck(map);
    });
  }, []);

  const nodes = useMemo<Node[]>(() => {
    if (!collection) return [];
    const course = loadCourse(collectionId);
    const stepsById = new Map(course?.steps.map((s) => [s.deck_id, s]) ?? []);
    const ordered = course
      ? course.steps.map((s) => s.deck_id).filter((id) => collection.deck_ids.includes(id))
      : collection.deck_ids;
    let prevReached = true;
    const out: Node[] = [];
    for (const id of ordered) {
      const deck = jobs.find((j) => j.id === id);
      if (!deck) continue;
      const cardIds = cardsByDeck[id] ?? [];
      const stats = deckScheduleStats(id, cardIds);
      const masteredPct = deck.n_cards ? Math.round((stats.mastered / deck.n_cards) * 100) : 0;
      const step = stepsById.get(id);
      const target = step?.target_mastered_pct ?? 60;
      const goal = step?.goal ?? "mastery";
      const reached = masteredPct >= target || step?.completed === true;
      const unlocked = prevReached;
      out.push({
        deck,
        mastered_pct: masteredPct,
        unlocked,
        completed: reached,
        target,
        goal,
      });
      prevReached = reached;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, jobs, cardsByDeck, version]);

  if (!collection || nodes.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Skill tree</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {collection.name}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {nodes.filter((n) => n.completed).length} / {nodes.length} cleared
        </Badge>
      </div>
      <CardContent className="p-5">
        <div className="relative">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {nodes.slice(0, -1).map((_, i) => {
              const x1 = ((i + 0.5) / nodes.length) * 100;
              const x2 = ((i + 1.5) / nodes.length) * 100;
              return (
                <motion.line
                  key={i}
                  x1={x1}
                  y1="50"
                  x2={x2}
                  y2="50"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.7"
                  strokeDasharray="1.5 1.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                />
              );
            })}
          </svg>
          <div className="relative grid gap-3" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
            {nodes.map((n, i) => (
              <motion.div
                key={n.deck.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex flex-col items-center text-center"
              >
                <Link
                  href={`/decks/${n.deck.id}` as any}
                  className={cn(
                    "grid h-16 w-16 place-items-center rounded-full border-2 transition-all",
                    n.completed
                      ? "border-success bg-success/10 text-success"
                      : n.unlocked
                      ? "border-primary bg-primary/5 text-primary hover:scale-105"
                      : "border-muted bg-muted/40 text-muted-foreground",
                  )}
                  title={`${n.deck.filename} - ${n.mastered_pct}% mastered`}
                >
                  {n.completed ? (
                    <Trophy className="h-6 w-6" />
                  ) : n.unlocked ? (
                    <Brain className="h-6 w-6" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                </Link>
                <p className="mt-2 text-xs font-medium leading-tight">
                  {truncate(loadDeckMeta(n.deck.id).alias || n.deck.filename, 18)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {n.mastered_pct}% / {n.target}%
                </p>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Each node unlocks the next when you reach its mastery target. Goals
          come from the course config (Master / Cover / Maintain).
        </p>
      </CardContent>
    </Card>
  );
}
