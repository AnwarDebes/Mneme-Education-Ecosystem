"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { listJobs } from "@/lib/api";
import { loadCollections, type Collection } from "@/lib/collections";
import {
  createExamPlan,
  deleteExamPlan,
  loadExamPlans,
  markSession,
  nextSession,
  planProgress,
  type ExamPlan,
} from "@/lib/exam-plan";
import { loadDeckMeta } from "@/lib/deck-store";
import { useStorageVersion } from "@/lib/hooks";
import { isoDate } from "@/lib/stats";
import type { JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ExamSchedulerPanel() {
  const version = useStorageVersion();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    setPlans(loadExamPlans());
    setCollections(loadCollections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    listJobs().then((js) => setJobs(js.filter((j) => j.status === "done"))).catch(() => setJobs([]));
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Practice exam scheduler</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {plans.length} {plans.length === 1 ? "plan" : "plans"} active
            </p>
          </div>
        </div>
        <NewExamDialog jobs={jobs} collections={collections} />
      </div>
      <CardContent className="space-y-3 p-4">
        {plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No exams scheduled. Pick a target date and we'll auto-schedule mock
            tests on a tightening cadence (weekly, then every 2 days, then daily
            in the final week).
          </p>
        ) : (
          <AnimatePresence>
            {plans.map((p) => (
              <ExamCard key={p.id} plan={p} jobs={jobs} collections={collections} />
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}

function ExamCard({
  plan,
  jobs,
  collections,
}: {
  plan: ExamPlan;
  jobs: JobSummary[];
  collections: Collection[];
}) {
  const progress = planProgress(plan);
  const next = nextSession(plan);
  const today = isoDate();
  const target = new Date(plan.target_date + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const daysLeft = Math.max(0, Math.round((target.getTime() - todayDate.getTime()) / 86400000));

  let scope: string = "Unknown";
  let firstDeckId: string | null = null;
  const scopeObj = plan.scope;
  if (scopeObj.kind === "deck") {
    const deck = jobs.find((j) => j.id === scopeObj.deck_id);
    if (deck) {
      const meta = loadDeckMeta(deck.id);
      scope = `Deck: ${meta.alias || deck.filename}`;
      firstDeckId = deck.id;
    }
  } else {
    const col = collections.find((c) => c.id === scopeObj.collection_id);
    if (col) {
      scope = `Collection: ${col.name}`;
      firstDeckId = col.deck_ids[0] ?? null;
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold">{plan.name}</p>
          <p className="text-xs text-muted-foreground">
            {scope} - {daysLeft} day{daysLeft === 1 ? "" : "s"} until{" "}
            {target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (typeof window !== "undefined" && !window.confirm(`Delete plan "${plan.name}"?`)) return;
            deleteExamPlan(plan.id);
            toast.success("Plan deleted");
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress.done} / {progress.total} mock tests done</span>
          <span>{progress.pct}%</span>
        </div>
        <Progress value={progress.pct} className="h-1.5" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {next ? (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>
              Next session:{" "}
              <span className="font-medium text-foreground">
                {new Date(next.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>{" "}
              - {next.question_count} questions in {next.duration_min} min
            </span>
          </div>
        ) : (
          <span className="text-xs text-success">All sessions complete</span>
        )}
        <div className="flex gap-1.5">
          {firstDeckId && next && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/study?job=${firstDeckId}&mode=test` as any}>
                <Play className="h-3.5 w-3.5" /> Take test
              </Link>
            </Button>
          )}
          {next && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                markSession(plan.id, next.date);
                toast.success(`Marked ${next.date} as done`);
              }}
            >
              <Check className="h-3.5 w-3.5" /> Mark done
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 sm:grid-cols-10 lg:grid-cols-14">
        {plan.sessions.map((s) => {
          const sd = new Date(s.date + "T00:00:00");
          const past = s.date < today;
          const isToday = s.date === today;
          return (
            <div
              key={s.date}
              title={`${s.date}: ${s.done ? "done" : past ? "missed" : "pending"}`}
              className={cn(
                "grid h-7 place-items-center rounded text-[10px] font-medium",
                s.done && "bg-success/15 text-success",
                !s.done && past && "bg-destructive/15 text-destructive",
                !s.done && !past && !isToday && "bg-muted text-muted-foreground",
                isToday && !s.done && "bg-primary/20 text-primary ring-1 ring-primary",
              )}
            >
              {sd.getDate()}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function NewExamDialog({
  jobs,
  collections,
}: {
  jobs: JobSummary[];
  collections: Collection[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return isoDate(d);
  });
  const [scopeType, setScopeType] = useState<"deck" | "collection">("deck");
  const [deckId, setDeckId] = useState<string | undefined>(jobs[0]?.id);
  const [collectionId, setCollectionId] = useState<string | undefined>(collections[0]?.id);
  const [questionCount, setQuestionCount] = useState(10);
  const [duration, setDuration] = useState(15);

  useEffect(() => {
    if (open) {
      setName("");
      setDeckId(jobs[0]?.id);
      setCollectionId(collections[0]?.id);
    }
  }, [open, jobs, collections]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give your exam a name");
      return;
    }
    const scope =
      scopeType === "deck" && deckId
        ? ({ kind: "deck", deck_id: deckId } as const)
        : scopeType === "collection" && collectionId
        ? ({ kind: "collection", collection_id: collectionId } as const)
        : null;
    if (!scope) {
      toast.error("Pick a deck or collection to study");
      return;
    }
    createExamPlan(name, date, scope, questionCount, duration);
    toast.success("Exam plan created");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" /> New exam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Schedule a practice exam
          </DialogTitle>
          <DialogDescription>
            Pick the deck or collection and a target date. We'll auto-schedule
            mock tests on a tightening cadence.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ename">Name</Label>
            <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bio midterm" autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edate">Target date</Label>
            <Input
              id="edate"
              type="date"
              min={isoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Scope</Label>
            <Select value={scopeType} onValueChange={(v) => setScopeType(v as "deck" | "collection")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deck">A single deck</SelectItem>
                <SelectItem value="collection">A whole collection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scopeType === "deck" ? (
            <Select value={deckId} onValueChange={setDeckId}>
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
          ) : collections.length > 0 ? (
            <Select value={collectionId} onValueChange={setCollectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">No collections yet.</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Question count</Label>
              <span className="font-mono text-sm">{questionCount}</span>
            </div>
            <Slider value={[questionCount]} min={3} max={40} step={1} onValueChange={(v) => setQuestionCount(v[0])} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Duration (min)</Label>
              <span className="font-mono text-sm">{duration}</span>
            </div>
            <Slider value={[duration]} min={5} max={60} step={1} onValueChange={(v) => setDuration(v[0])} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={submit}>
            <Sparkles className="h-4 w-4" /> Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
