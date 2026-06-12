"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Anchor, BarChart3, Clock, History, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCardSchedule, type CardReview } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import { isAnchor, toggleAnchor } from "@/lib/anchors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CardStatsPanelProps {
  deckId: string;
  cardId: string;
  className?: string;
}

const GRADE_COLOR: Record<CardReview["grade"], string> = {
  again: "bg-destructive",
  hard: "bg-warn",
  good: "bg-primary",
  easy: "bg-success",
};

export function CardStatsPanel({ deckId, cardId, className }: CardStatsPanelProps) {
  const version = useStorageVersion();
  const schedule = useMemo(() => getCardSchedule(deckId, cardId), [deckId, cardId, version]);
  const anchored = useMemo(() => isAnchor(deckId, cardId), [deckId, cardId, version]);

  const history = schedule.history;
  const total = history.length;
  const correct = history.filter((h) => h.grade === "good" || h.grade === "easy").length;
  const partial = history.filter((h) => h.grade === "hard").length;
  const wrong = history.filter((h) => h.grade === "again").length;
  const accuracy = total ? Math.round(((correct + partial * 0.5) / total) * 100) : 0;

  // Tiny inline SVG: dot per review on a horizontal timeline. Y axis = grade.
  const w = 320;
  const h = 80;
  const items = history.slice(-30);
  const stride = items.length > 1 ? (w - 24) / (items.length - 1) : 0;
  const yFor = (g: CardReview["grade"]) =>
    g === "easy" ? 14 : g === "good" ? 30 : g === "hard" ? 46 : 62;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Card stats</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {total} reviews logged
            </p>
          </div>
        </div>
        <Button
          variant={anchored ? "default" : "outline"}
          size="sm"
          onClick={() => {
            const next = toggleAnchor(deckId, cardId);
            toast.success(next ? "Anchored as foundational" : "Anchor removed");
          }}
        >
          <Anchor className="h-3.5 w-3.5" /> {anchored ? "Anchored" : "Anchor"}
        </Button>
      </div>
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile icon={Sparkles} label="Reps" value={String(schedule.reps)} />
          <Tile
            icon={TrendingUp}
            label="Ease"
            value={schedule.ease.toFixed(2)}
            tone={schedule.ease >= 2.5 ? "ok" : schedule.ease >= 2.0 ? "warn" : "bad"}
          />
          <Tile icon={Clock} label="Interval" value={`${Math.round(schedule.interval_days)}d`} />
          <Tile
            icon={TrendingDown}
            label="Lapses"
            value={String(schedule.lapses)}
            tone={schedule.lapses === 0 ? "ok" : "bad"}
          />
        </div>

        {total > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {accuracy}% accurate ({correct} ok / {partial} partial / {wrong} miss)
              </span>
              <span>
                next due{" "}
                {new Date(schedule.due_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full">
              <line x1="12" y1={yFor("easy")} x2={w - 12} y2={yFor("easy")} stroke="hsl(var(--success) / 0.2)" strokeWidth="0.5" />
              <line x1="12" y1={yFor("good")} x2={w - 12} y2={yFor("good")} stroke="hsl(var(--primary) / 0.2)" strokeWidth="0.5" />
              <line x1="12" y1={yFor("hard")} x2={w - 12} y2={yFor("hard")} stroke="hsl(var(--warn) / 0.2)" strokeWidth="0.5" />
              <line x1="12" y1={yFor("again")} x2={w - 12} y2={yFor("again")} stroke="hsl(var(--destructive) / 0.2)" strokeWidth="0.5" />
              {items.map((h, i) => (
                <motion.circle
                  key={i}
                  cx={12 + i * stride}
                  cy={yFor(h.grade)}
                  r="4"
                  className={GRADE_COLOR[h.grade]}
                  fill="currentColor"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                />
              ))}
              {items.length > 1 &&
                items.slice(0, -1).map((h, i) => (
                  <motion.line
                    key={i}
                    x1={12 + i * stride}
                    y1={yFor(h.grade)}
                    x2={12 + (i + 1) * stride}
                    y2={yFor(items[i + 1].grade)}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.1 + i * 0.02 }}
                  />
                ))}
            </svg>
            <div className="grid grid-cols-4 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="text-success">easy</span>
              <span className="text-primary">good</span>
              <span className="text-warn">hard</span>
              <span className="text-destructive">again</span>
            </div>
            <ReviewList history={history.slice(-6).reverse()} />
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No reviews yet. Grade this card in any study mode and you'll see its
            curve here.
          </p>
        )}

        <DecaySimulator schedule={schedule} />
      </CardContent>
    </Card>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="flex items-center justify-between">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className={cn("font-display text-lg font-semibold leading-none", toneCls)}>{value}</p>
    </div>
  );
}

function ReviewList({ history }: { history: CardReview[] }) {
  if (history.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
      {history.map((h, i) => (
        <li key={i} className="flex items-center justify-between">
          <span>
            <History className="inline h-3 w-3" /> {new Date(h.graded_at).toLocaleString()}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-medium",
                h.grade === "easy" && "bg-success/10 text-success",
                h.grade === "good" && "bg-primary/10 text-primary",
                h.grade === "hard" && "bg-warn/10 text-warn",
                h.grade === "again" && "bg-destructive/10 text-destructive",
              )}
            >
              {h.grade}
            </span>
            <span>{Math.round(h.interval_days)}d</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DecaySimulator({ schedule }: { schedule: ReturnType<typeof getCardSchedule> }) {
  // Simple exponential forgetting: retention(t) = exp(-t / S) where S is the
  // stability scale. We use interval * ease as a rough stability proxy.
  const stability = Math.max(1, schedule.interval_days * Math.max(1, schedule.ease - 1.3));
  const w = 320;
  const h = 64;
  const days = 60;
  const points: { x: number; y: number; t: number; r: number }[] = [];
  for (let i = 0; i <= days; i++) {
    const r = Math.exp(-i / stability);
    points.push({ x: 12 + (i / days) * (w - 24), y: 56 - r * 48, t: i, r });
  }
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="space-y-1 rounded-md border bg-secondary/30 p-3">
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-1 text-xs font-semibold">
          <Activity className="h-3 w-3 text-primary" /> Decay simulator
        </p>
        <Badge variant="outline" className="text-[10px]">
          if you stop reviewing
        </Badge>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
        <line x1="12" y1="56" x2={w - 12} y2="56" stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1="12" y1="8" x2="12" y2="56" stroke="hsl(var(--border))" strokeWidth="1" />
        <motion.path
          d={pathD}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
        {[0, 14, 30, 60].map((d) => {
          const x = 12 + (d / days) * (w - 24);
          return (
            <g key={d}>
              <line x1={x} y1="56" x2={x} y2="58" stroke="hsl(var(--border))" strokeWidth="1" />
              <text x={x} y="63" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">
                {d}d
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-muted-foreground">
        Predicted retention curve from now if no further review. Stability
        derived from your ease+interval; flatter = stronger memory.
      </p>
    </div>
  );
}
