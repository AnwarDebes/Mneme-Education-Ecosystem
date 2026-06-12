"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MicButton } from "@/components/mic-button";
import { SessionSummary } from "@/components/session-summary";
import { ConfidenceRating } from "@/components/confidence-rating";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import { logConfidence } from "@/lib/confidence";
import type { ResolvedCard } from "@/lib/cards";
import { useSwipe } from "@/lib/use-swipe";
import { cn } from "@/lib/utils";

interface ClozeModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

interface ClozeQuestion {
  card: ResolvedCard;
  before: string;
  after: string;
  target: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Use the source fact if it contains the answer, otherwise blank the answer
// inside the question. If neither works, fall back to "answer the question".
function buildCloze(card: ResolvedCard): ClozeQuestion | null {
  const answer = card.answer.trim();
  if (!answer) return null;
  if (card.source_fact) {
    const re = new RegExp(`\\b${escapeRegex(answer)}\\b`, "i");
    const match = card.source_fact.match(re);
    if (match) {
      const idx = match.index ?? -1;
      if (idx >= 0) {
        return {
          card,
          before: card.source_fact.slice(0, idx),
          after: card.source_fact.slice(idx + match[0].length),
          target: match[0],
        };
      }
    }
  }
  const re = new RegExp(`\\b${escapeRegex(answer)}\\b`, "i");
  const match = card.question.match(re);
  if (match) {
    const idx = match.index ?? -1;
    if (idx >= 0) {
      return {
        card,
        before: card.question.slice(0, idx),
        after: card.question.slice(idx + match[0].length),
        target: match[0],
      };
    }
  }
  return {
    card,
    before: card.question + " ",
    after: "",
    target: answer,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’']/g, "'").replace(/[^a-z0-9 ]/g, "").trim();
}

export function ClozeMode({ deckId, cards }: ClozeModeProps) {
  const questions = useMemo(() => {
    return cards.map(buildCloze).filter((q): q is ClozeQuestion => q !== null);
  }, [cards]);
  const [position, setPosition] = useState(0);
  const [guess, setGuess] = useState("");
  const [state, setState] = useState<"typing" | "correct" | "wrong" | "revealed">("typing");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);

  const q = questions[position];
  const finished = position >= questions.length;

  useEffect(() => {
    if (state === "typing") inputRef.current?.focus();
  }, [state, position]);

  const submit = () => {
    if (!q) return;
    const isRight = normalize(guess) === normalize(q.target);
    if (isRight) {
      setState("correct");
      setCorrect((c) => c + 1);
      scheduleGrade(deckId, q.card.id, "good");
      recordReview("good");
      if (confidence != null) logConfidence({ deck_id: deckId, card_id: q.card.id, predicted: confidence, actual: "good" });
    } else {
      setState("wrong");
      setWrong((w) => w + 1);
      scheduleGrade(deckId, q.card.id, "again");
      recordReview("again");
      if (confidence != null) logConfidence({ deck_id: deckId, card_id: q.card.id, predicted: confidence, actual: "again" });
    }
  };

  const reveal = () => {
    if (!q) return;
    setState("revealed");
    setWrong((w) => w + 1);
    scheduleGrade(deckId, q.card.id, "hard");
    recordReview("hard");
  };

  const advance = () => {
    setGuess("");
    setState("typing");
    setConfidence(null);
    setPosition((p) => p + 1);
  };

  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipe(swipeRef, {
    onSwipeLeft: () => {
      if (state !== "typing") advance();
    },
    onSwipeRight: () => {
      if (state !== "typing") advance();
      else reveal();
    },
  });

  if (finished || !q) {
    return (
      <SessionSummary
        total={correct + wrong}
        correct={correct}
        again={wrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setGuess("");
          setState("typing");
          setCorrect(0);
          setWrong(0);
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
            Card {position + 1} of {questions.length}
          </span>
          <span>
            {correct} correct - {wrong} missed
          </span>
        </div>
        <Progress value={(position / questions.length) * 100} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={position}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          <Card className="paper">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fill in the blank
              </p>
              <p className="font-display text-xl leading-relaxed sm:text-2xl">
                <span>{q.before}</span>
                {state === "typing" ? (
                  <span className="mx-1 inline-block min-w-[6ch] border-b-2 border-primary/60 align-baseline" />
                ) : state === "revealed" ? (
                  <span className="mx-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-warn">
                    {q.target}
                  </span>
                ) : state === "correct" ? (
                  <span className="mx-1 rounded-md bg-success/15 px-1.5 py-0.5 text-success">
                    {guess.trim() || q.target}
                  </span>
                ) : (
                  <span className="mx-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-destructive line-through">
                    {guess.trim() || "-"}
                  </span>
                )}
                <span>{q.after}</span>
              </p>

              {state !== "typing" && state !== "correct" && (
                <p className="text-sm text-muted-foreground">
                  Expected: <span className="font-medium text-foreground">{q.target}</span>
                </p>
              )}

              {state === "typing" && (
                <ConfidenceRating value={confidence} onChange={setConfidence} />
              )}

              <div className="flex flex-wrap items-center gap-2">
                {state === "typing" ? (
                  <>
                    <Input
                      ref={inputRef}
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                      }}
                      placeholder="Type your answer"
                      className="flex-1"
                    />
                    <MicButton onTranscript={(t) => setGuess(t)} />
                    <Button onClick={submit} disabled={!guess.trim()}>
                      <Check className="h-4 w-4" /> Check
                    </Button>
                    <Button variant="ghost" onClick={reveal}>
                      <Eye className="h-4 w-4" /> Reveal
                    </Button>
                  </>
                ) : (
                  <Button onClick={advance} className="ml-auto">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="rounded-md bg-secondary/40 p-3 text-xs">
                <p className="font-medium">Original prompt</p>
                <p className="mt-1 italic text-muted-foreground">{q.card.question}</p>
              </div>

              {state === "correct" && (
                <p className="flex items-center gap-1 text-sm font-medium text-success">
                  <Check className="h-4 w-4" /> Got it.
                </p>
              )}
              {state === "wrong" && (
                <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <X className="h-4 w-4" /> Not quite. Try again next round.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
