"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  GraduationCap,
  Loader2,
  Play,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkillTree } from "@/components/skill-tree";
import { jobDetail, listJobs } from "@/lib/api";
import { loadCollections, type Collection } from "@/lib/collections";
import {
  createCourse,
  deleteCourse,
  loadCourse,
  reorderSteps,
  setStepGoal,
  toggleStepComplete,
  type Course,
  type CourseStep,
  type GoalKind,
} from "@/lib/course";
import { loadDeckMeta } from "@/lib/deck-store";
import { deckScheduleStats } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CourseShellProps {
  collectionId: string;
}

const GOAL_LABEL: Record<GoalKind, string> = {
  mastery: "Master",
  coverage: "Cover",
  maintenance: "Maintain",
};

export function CourseShell({ collectionId }: CourseShellProps) {
  const version = useStorageVersion();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, string[]>>({});
  const course = useMemo(() => loadCourse(collectionId), [collectionId, version]);

  useEffect(() => {
    const c = loadCollections().find((x) => x.id === collectionId) ?? null;
    setCollection(c);
  }, [collectionId, version]);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
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
      })
      .catch(() => setJobs([]));
  }, []);

  if (!collection) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Collection not found</CardTitle>
            <CardDescription>
              Open the library and pick or create a collection first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const deckById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <div>
          <Link
            href={"/library" as any}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Library
          </Link>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Course</p>
              <h1 className="font-display text-4xl font-semibold tracking-tight">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="text-sm text-muted-foreground">{collection.description}</p>
              )}
            </div>
            {course && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm("End this course? The collection stays.")) return;
                  deleteCourse(collectionId);
                  toast.success("Course ended");
                }}
              >
                End course
              </Button>
            )}
          </div>
        </div>

        {course ? (
          <>
            <SkillTree collectionId={collectionId} />
            <CourseBoard
              collection={collection}
              course={course}
              deckById={deckById}
              cardsByDeck={cardsByDeck}
            />
          </>
        ) : (
          <SetupCourse collection={collection} deckById={deckById} />
        )}
      </div>
    </div>
  );
}

function SetupCourse({ collection, deckById }: { collection: Collection; deckById: Map<string, JobSummary> }) {
  const decks = collection.deck_ids
    .map((id) => deckById.get(id))
    .filter((d): d is JobSummary => !!d);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" /> Start as a course
        </CardTitle>
        <CardDescription>
          Sequence these decks as a curriculum. Each becomes a step with a goal
          (master / cover / maintain). Progress through them top to bottom.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This collection has no decks yet. Add some in the library, then come back.
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {decks.map((d, i) => {
                const meta = loadDeckMeta(d.id);
                return (
                  <li key={d.id} className="flex items-center gap-3 rounded-md border bg-secondary/30 p-3 text-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span>{meta.alias || d.filename}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {d.n_cards} cards
                    </Badge>
                  </li>
                );
              })}
            </ol>
            <Button onClick={() => createCourse(collection.id, decks.map((d) => d.id))}>
              <Play className="h-4 w-4" /> Start course
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CourseBoard({
  collection,
  course,
  deckById,
  cardsByDeck,
}: {
  collection: Collection;
  course: Course;
  deckById: Map<string, JobSummary>;
  cardsByDeck: Record<string, string[]>;
}) {
  const steps = course.steps;
  const completed = steps.filter((s) => s.completed).length;
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const move = (idx: number, delta: number) => {
    const newOrder = steps.map((s) => s.deck_id);
    const target = idx + delta;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    reorderSteps(collection.id, newOrder);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-lg font-semibold">
              {completed} / {steps.length} steps complete
            </p>
            <Badge variant="outline">{pct}%</Badge>
          </div>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>

      <ol className="space-y-2">
        {steps.map((step, i) => {
          const deck = deckById.get(step.deck_id);
          if (!deck) return null;
          return (
            <StepRow
              key={step.deck_id}
              i={i}
              step={step}
              deck={deck}
              collectionId={collection.id}
              total={steps.length}
              cardIds={cardsByDeck[step.deck_id] ?? []}
              onMove={move}
            />
          );
        })}
      </ol>
    </div>
  );
}

function StepRow({
  i,
  step,
  deck,
  collectionId,
  total,
  cardIds,
  onMove,
}: {
  i: number;
  step: CourseStep;
  deck: JobSummary;
  collectionId: string;
  total: number;
  cardIds: string[];
  onMove: (i: number, delta: number) => void;
}) {
  const stats = deckScheduleStats(step.deck_id, cardIds);
  const meta = loadDeckMeta(deck.id);
  const target = step.target_mastered_pct ?? 80;
  const masteryPct = deck.n_cards ? Math.round((stats.mastered / deck.n_cards) * 100) : 0;
  const reached = masteryPct >= target;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-3 sm:p-4",
        step.completed && "border-success/40 bg-success/5",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => toggleStepComplete(collectionId, step.deck_id)}
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
            step.completed
              ? "border-success bg-success/10 text-success"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
          title="Toggle complete"
        >
          {step.completed ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Step {i + 1}
              </p>
              <Link
                href={`/decks/${deck.id}` as any}
                className="truncate font-display text-lg font-semibold hover:underline"
              >
                {meta.alias || deck.filename}
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                title="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={i === total - 1}
                onClick={() => onMove(i, 1)}
                title="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Mastery {masteryPct}% / target {target}%
                </span>
                {reached && (
                  <Badge variant="outline" className="border-success/50 text-success text-[10px]">
                    <Trophy className="h-3 w-3" /> goal hit
                  </Badge>
                )}
              </div>
              <Progress value={Math.min(100, (masteryPct / Math.max(1, target)) * 100)} className="h-1.5" />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={step.goal}
                onValueChange={(v) =>
                  setStepGoal(collectionId, step.deck_id, v as GoalKind, step.target_mastered_pct)
                }
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mastery">Mastery</SelectItem>
                  <SelectItem value="coverage">Coverage</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                max="100"
                value={target}
                onChange={(e) =>
                  setStepGoal(
                    collectionId,
                    step.deck_id,
                    step.goal,
                    Math.max(0, Math.min(100, Number(e.target.value))),
                  )
                }
                className="h-7 w-16 text-xs"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button asChild size="sm" variant="outline">
                <Link href={`/study?job=${deck.id}` as any}>
                  <Play className="h-3.5 w-3.5" /> Study
                </Link>
              </Button>
              <Badge variant="outline" className="text-[10px]">
                {GOAL_LABEL[step.goal]}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </motion.li>
  );
}
