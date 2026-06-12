"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionSummary } from "@/components/session-summary";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import type { ResolvedCard } from "@/lib/cards";
import { useSwipe } from "@/lib/use-swipe";
import { cn } from "@/lib/utils";

interface SpeedModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

const TURN_MS = 5000;

export function SpeedMode({ deckId, cards }: SpeedModeProps) {
  const order = useMemo(() => {
    const idxs = cards.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    return idxs;
  }, [cards]);
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<"question" | "answer">("question");
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now());
  const [resetKey, setResetKey] = useState(0);

  const card = useMemo(() => {
    const idx = order[position];
    return idx == null ? null : cards[idx] ?? null;
  }, [cards, order, position]);
  const finished = position >= cards.length;

  useEffect(() => {
    if (paused || finished) return;
    const id = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, [paused, finished, phase, position]);

  const elapsed = Math.min(TURN_MS, Date.now() - phaseStartedAt);
  const pct = Math.min(100, (elapsed / TURN_MS) * 100);

  useEffect(() => {
    if (paused || finished) return;
    if (elapsed >= TURN_MS) {
      if (phase === "question") {
        setPhase("answer");
        setPhaseStartedAt(Date.now());
      } else {
        if (card) {
          setWrong((w) => w + 1);
          scheduleGrade(deckId, card.id, "again");
          recordReview("again");
        }
        setPhase("question");
        setPosition((p) => p + 1);
        setPhaseStartedAt(Date.now());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const grade = useCallback(
    (gradeName: "good" | "again") => {
      if (!card) return;
      if (gradeName === "good") {
        setCorrect((c) => c + 1);
        scheduleGrade(deckId, card.id, "good");
        recordReview("good");
      } else {
        setWrong((w) => w + 1);
        scheduleGrade(deckId, card.id, "again");
        recordReview("again");
      }
      setPhase("question");
      setPosition((p) => p + 1);
      setPhaseStartedAt(Date.now());
    },
    [card, deckId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") setPaused((p) => !p);
      if (phase === "answer") {
        if (e.key === "y" || e.key === "Y") grade("good");
        if (e.key === "n" || e.key === "N") grade("again");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, grade]);

  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipe(swipeRef, {
    onSwipeRight: () => phase === "answer" && grade("good"),
    onSwipeLeft: () => phase === "answer" && grade("again"),
  });

  if (finished) {
    return (
      <SessionSummary
        total={correct + wrong}
        correct={correct}
        again={wrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setPhase("question");
          setCorrect(0);
          setWrong(0);
          setPhaseStartedAt(Date.now());
          setResetKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-6" key={resetKey} ref={swipeRef}>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Card {position + 1} of {cards.length}
          </span>
          <span>
            {correct} hit - {wrong} miss
          </span>
        </div>
        <Progress value={(position / cards.length) * 100} />
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 bg-muted">
          <motion.div
            className={cn("h-full", phase === "question" ? "bg-primary" : "bg-success")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Timer className="h-3 w-3" />
              {phase === "question" ? "Recall" : "Reveal"}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${position}-${phase}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <p className="text-balance text-center font-display text-2xl font-medium leading-snug sm:text-3xl">
                {phase === "question" ? card?.question : card?.answer}
              </p>
            </motion.div>
          </AnimatePresence>
          {phase === "answer" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => grade("again")}>
                Missed (N)
              </Button>
              <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => grade("good")}>
                Got it (Y)
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Reveal in {Math.max(0, Math.ceil((TURN_MS - elapsed) / 1000))}s ... P to pause.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
