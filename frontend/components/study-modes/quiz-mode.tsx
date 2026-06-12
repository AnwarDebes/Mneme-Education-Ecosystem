"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionSummary } from "@/components/session-summary";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import { addXP } from "@/lib/xp";
import { bumpQuest } from "@/lib/quests";
import { recordTiming } from "@/lib/timing";
import { useSwipe } from "@/lib/use-swipe";
import { useRef } from "react";
import { logConfidence } from "@/lib/confidence";
import { ConfidenceRating } from "@/components/confidence-rating";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

interface QuizModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Question {
  card: ResolvedCard;
  options: string[];
  correctIndex: number;
}

function buildQuestions(cards: ResolvedCard[]): Question[] {
  const all = cards.map((c) => c.answer);
  return shuffled(cards).map((card) => {
    const distractors = shuffled(all.filter((a) => a !== card.answer)).slice(0, 3);
    while (distractors.length < 3) distractors.push("(no other option)");
    const options = shuffled([card.answer, ...distractors]);
    return { card, options, correctIndex: options.indexOf(card.answer) };
  });
}

export function QuizMode({ deckId, cards }: QuizModeProps) {
  const [questions] = useState<Question[]>(() => buildQuestions(cards));
  const [position, setPosition] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [scoreCorrect, setScoreCorrect] = useState(0);
  const [scoreWrong, setScoreWrong] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [resetKey, setResetKey] = useState(0);

  const q = questions[position];
  const finished = position >= questions.length;

  const reveal = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    const correct = idx === q.correctIndex;
    if (correct) {
      setScoreCorrect((s) => s + 1);
      scheduleGrade(deckId, q.card.id, "good");
      recordReview("good");
      recordTiming({ mode: "quiz", grade: "good", ms: Date.now() - startedAt });
      addXP(2);
      if (confidence != null) logConfidence({ deck_id: deckId, card_id: q.card.id, predicted: confidence, actual: "good" });
    } else {
      setScoreWrong((s) => s + 1);
      scheduleGrade(deckId, q.card.id, "again");
      recordReview("again");
      recordTiming({ mode: "quiz", grade: "again", ms: Date.now() - startedAt });
      addXP(1);
      if (confidence != null) logConfidence({ deck_id: deckId, card_id: q.card.id, predicted: confidence, actual: "again" });
    }
    bumpQuest("reviews", 1);
  };

  const advance = () => {
    setPicked(null);
    setConfidence(null);
    setPosition((p) => p + 1);
  };

  const swipeRef = useRef<HTMLDivElement | null>(null);
  useSwipe(swipeRef, {
    onSwipeLeft: () => picked !== null && advance(),
    onSwipeRight: () => picked !== null && advance(),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.target instanceof HTMLInputElement) return;
      if (/^[1-4]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < q.options.length) reveal(idx);
      } else if ((e.key === " " || e.key === "Enter") && picked !== null) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, q, finished]);

  if (finished) {
    return (
      <SessionSummary
        total={scoreCorrect + scoreWrong}
        correct={scoreCorrect}
        again={scoreWrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setPicked(null);
          setScoreCorrect(0);
          setScoreWrong(0);
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
            Question {position + 1} of {questions.length}
          </span>
          <span>
            {scoreCorrect}/{scoreCorrect + scoreWrong} correct
          </span>
        </div>
        <Progress value={((position + (picked !== null ? 1 : 0)) / questions.length) * 100} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={position}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
        >
          <Card className="paper">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">
                  {q.card.effective_difficulty ?? "unrated"}
                </Badge>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Multiple choice
                </p>
              </div>
              <p className="text-balance font-display text-2xl font-medium leading-snug sm:text-3xl">
                {q.card.question}
              </p>
              {picked === null && (
                <ConfidenceRating value={confidence} onChange={setConfidence} />
              )}
              <div className="grid gap-2">
                {q.options.map((opt, idx) => {
                  const isCorrect = idx === q.correctIndex;
                  const isPicked = picked === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => reveal(idx)}
                      disabled={picked !== null}
                      className={cn(
                        "flex items-center justify-between rounded-lg border bg-background p-3 text-left text-sm transition-all",
                        picked === null && "hover:border-primary/60 hover:bg-primary/5",
                        picked !== null && isCorrect && "border-success bg-success/10",
                        picked !== null && !isCorrect && isPicked && "border-destructive bg-destructive/10",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-medium">
                          {idx + 1}
                        </span>
                        <span>{opt}</span>
                      </span>
                      {picked !== null && isCorrect && <Check className="h-4 w-4 text-success" />}
                      {picked !== null && isPicked && !isCorrect && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>
              {picked !== null && q.card.source_fact && (
                <div className="rounded-md bg-secondary/40 p-3 text-xs">
                  <p className="font-medium">Source</p>
                  <p className="mt-1 italic text-muted-foreground">{q.card.source_fact}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end">
        <Button onClick={advance} disabled={picked === null}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
