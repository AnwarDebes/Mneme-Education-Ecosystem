"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bumpQuest } from "@/lib/quests";
import { logPomodoro } from "@/lib/pomodoro-history";
import { cn } from "@/lib/utils";

interface PomodoroProps {
  className?: string;
  defaultMinutes?: number;
  breakMinutes?: number;
  onSessionComplete?: (minutes: number) => void;
}

type Phase = "focus" | "break";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function PomodoroTimer({
  className,
  defaultMinutes = 25,
  breakMinutes = 5,
  onSessionComplete,
}: PomodoroProps) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(defaultMinutes * 60);
  const [completed, setCompleted] = useState(0);
  const focusRef = useRef(defaultMinutes);
  const breakRef = useRef(breakMinutes);

  // Wall-clock based ticker. setInterval drifts and a hidden tab throttles
  // it to ~once/minute - reading Date.now() each tick keeps the timer
  // accurate across tab switches and OS sleeps. We also clamp huge gaps
  // (laptop closed for an hour) so a single wake doesn't burn the whole
  // session in one frame.
  const wallStartRef = useRef<number | null>(null);
  const wallBaseRemainingRef = useRef(remaining);

  useEffect(() => {
    if (!running) {
      wallStartRef.current = null;
      return;
    }
    wallStartRef.current = Date.now();
    wallBaseRemainingRef.current = remaining;

    const tick = () => {
      if (wallStartRef.current == null) return;
      const elapsedSec = Math.floor((Date.now() - wallStartRef.current) / 1000);
      const next = Math.max(0, wallBaseRemainingRef.current - elapsedSec);
      setRemaining(next);
    };
    const id = setInterval(tick, 1000);

    // Recompute immediately on visibility change so coming back from a
    // hidden tab catches up in one shot instead of accruing 1s per tick.
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (remaining > 0) return;
    if (phase === "focus") {
      setCompleted((c) => c + 1);
      onSessionComplete?.(focusRef.current);
      bumpQuest("minutes", focusRef.current);
      logPomodoro(focusRef.current);
      setPhase("break");
      setRemaining(breakRef.current * 60);
    } else {
      setPhase("focus");
      setRemaining(focusRef.current * 60);
      setRunning(false);
    }
  }, [remaining, phase, onSessionComplete]);

  const total = phase === "focus" ? focusRef.current * 60 : breakRef.current * 60;
  const pct = useMemo(() => 100 - Math.round((remaining / total) * 100), [remaining, total]);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const restart = () => {
    setRunning(false);
    setPhase("focus");
    setRemaining(focusRef.current * 60);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {phase === "focus" ? (
              <Timer className="h-4 w-4 text-primary" />
            ) : (
              <Coffee className="h-4 w-4 text-success" />
            )}
            <p className="text-sm font-medium">
              {phase === "focus" ? "Focus" : "Break"} - Pomodoro {completed + 1}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{completed} done</p>
        </div>

        <div className="relative grid place-items-center">
          <svg width="140" height="140" viewBox="0 0 140 140" className="text-primary">
            <circle
              cx="70"
              cy="70"
              r="62"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <motion.circle
              cx="70"
              cy="70"
              r="62"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 62}
              animate={{ strokeDashoffset: 2 * Math.PI * 62 * (1 - pct / 100) }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="absolute font-display text-2xl font-semibold">
            {pad(minutes)}:{pad(seconds)}
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Start"}
          </Button>
          <Button size="sm" variant="outline" onClick={restart}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
