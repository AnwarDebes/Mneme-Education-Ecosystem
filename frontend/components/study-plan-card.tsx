"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  createPlan,
  deletePlan,
  loadPlan,
  planProgress,
  type StudyPlan,
} from "@/lib/study-plan";
import { useStorageVersion } from "@/lib/hooks";
import { isoDate } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StudyPlanCardProps {
  deckId: string;
  cardCount: number;
}

export function StudyPlanCard({ deckId, cardCount }: StudyPlanCardProps) {
  const version = useStorageVersion();
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  useEffect(() => {
    setPlan(loadPlan(deckId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version]);

  if (!plan) {
    return <NoPlan deckId={deckId} cardCount={cardCount} />;
  }
  return <ActivePlan plan={plan} cardCount={cardCount} />;
}

function NoPlan({ deckId, cardCount }: { deckId: string; cardCount: number }) {
  const [creating, setCreating] = useState(false);
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return isoDate(d);
  })();
  const [date, setDate] = useState(tomorrow);
  const [goal, setGoal] = useState("Master this deck");

  if (!creating) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <p className="font-display text-base font-semibold">Set a study plan</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick a target date. We'll compute the cards-per-day you need to hit it
            and track your progress.
          </p>
          <Button onClick={() => setCreating(true)} variant="outline">
            <Sparkles className="h-4 w-4" /> Plan this deck
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="font-display text-base font-semibold">New plan</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="plan-goal">Goal</Label>
            <Input
              id="plan-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does done look like?"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-date">Target date</Label>
            <Input
              id="plan-date"
              type="date"
              value={date}
              min={isoDate()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!date) return;
              createPlan(deckId, cardCount, date, goal);
              toast.success("Study plan created");
              setCreating(false);
            }}
          >
            <Flag className="h-4 w-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivePlan({ plan, cardCount }: { plan: StudyPlan; cardCount: number }) {
  const progress = planProgress(plan);
  const targetReadable = new Date(plan.target_date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const statusBadge = {
    on_pace: { label: "On pace", classes: "border-success/40 text-success" },
    behind: { label: "Behind", classes: "border-destructive/40 text-destructive" },
    ahead: { label: "Ahead", classes: "border-primary/40 text-primary" },
    done: { label: "Done", classes: "border-success/40 text-success" },
    expired: { label: "Past target", classes: "border-warn/40 text-warn" },
  }[progress.status];

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              <p className="font-display text-base font-semibold">{plan.goal}</p>
              <Badge variant="outline" className={statusBadge.classes}>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: {targetReadable} -{" "}
              {progress.days_left > 0 ? `${progress.days_left} days left` : "today"} -{" "}
              {plan.cards_per_day} cards/day
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Delete this study plan?")) return;
              deletePlan(plan.deck_id);
              toast.success("Plan removed");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Mini icon={Target} value={`${progress.achieved_pct}%`} label="Achieved" />
          <Mini icon={CalendarDays} value={`${progress.target_pct}%`} label="Expected today" />
          <Mini icon={Clock} value={`${progress.reviewed_today}/${plan.cards_per_day}`} label="Today" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.reviewed_total} / {plan.total_cards} reviews
            </span>
            <span>{progress.achieved_pct}%</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                progress.status === "behind" ? "bg-destructive" : "bg-primary",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress.achieved_pct}%` }}
              transition={{ duration: 0.5 }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/40"
              style={{ left: `${progress.target_pct}%` }}
              title={`Target line: ${progress.target_pct}%`}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Vertical line = where you should be today
          </p>
        </div>

        {progress.status === "done" && (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Plan complete. {cardCount} cards mastered.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-2">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-0.5 font-display text-lg font-semibold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
