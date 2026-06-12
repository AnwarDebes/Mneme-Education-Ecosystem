"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Edit3, Target, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { clearGoal, goalProgress, loadGoal, saveGoal, type SessionGoal } from "@/lib/session-goal";
import { useStorageVersion } from "@/lib/hooks";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SessionGoalWidget() {
  const version = useStorageVersion();
  const [goal, setGoal] = useState<SessionGoal | null>(null);
  const [editing, setEditing] = useState(false);
  const [cards, setCards] = useState(20);
  const [minutes, setMinutes] = useState(25);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    const g = loadGoal();
    setGoal(g);
    if (g) {
      setCards(g.cards);
      setMinutes(g.minutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (!goal) return;
    const p = goalProgress(goal);
    if (p.achieved && !celebrated) {
      setCelebrated(true);
      fireConfetti({ particles: 60, durationMs: 2000 });
      toast.success("Session goal achieved!");
    }
  }, [goal, version, celebrated]);

  const submit = () => {
    saveGoal(Math.max(1, cards), Math.max(1, minutes));
    setEditing(false);
    setCelebrated(false);
    toast.success("Goal set for today");
  };

  if (!goal && !editing) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>No goal set for today.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Set goal
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Today's goal</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="g-cards">Cards</Label>
              <Input
                id="g-cards"
                type="number"
                min="1"
                value={cards}
                onChange={(e) => setCards(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-min">Minutes</Label>
              <Input
                id="g-min"
                type="number"
                min="1"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={submit}>
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const p = goalProgress(goal!);
  return (
    <Card className={cn(p.achieved && "border-success/40 bg-success/5")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className={cn("h-4 w-4", p.achieved ? "text-success" : "text-primary")} />
            <p className="text-sm font-semibold">Today's goal</p>
            {p.achieved && (
              <Badge variant="outline" className="border-success/40 text-success">
                <Check className="h-3 w-3" /> achieved
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Edit3 className="h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearGoal();
                toast.success("Goal cleared");
              }}
            >
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          </div>
        </div>
        <Row label="Cards" done={p.cards_done} target={goal!.cards} pct={p.cards_pct} />
        <Row label="Minutes" done={p.minutes_done} target={goal!.minutes} pct={p.minutes_pct} />
        <AnimatePresence>
          {p.achieved && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm font-medium text-success"
            >
              Done for the day. Anything more is bonus.
            </motion.p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function Row({ label, done, target, pct }: { label: string; done: number; target: number; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {done} / {target}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
