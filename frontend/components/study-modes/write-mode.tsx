"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ChevronRight, Eye, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/mic-button";
import { SessionSummary } from "@/components/session-summary";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import type { ResolvedCard } from "@/lib/cards";
import { useSwipe } from "@/lib/use-swipe";
import { logConfidence } from "@/lib/confidence";
import { ConfidenceRating } from "@/components/confidence-rating";
import { cn } from "@/lib/utils";

interface WriteModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’']/g, "'")
    .replace(/[“”"]/g, '"')
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "of", "in", "on", "at", "to",
  "for", "and", "or", "but", "with", "by", "as", "from", "that", "this",
  "be", "been", "being", "it", "its", "into",
]);

function tokenOverlap(guess: string, expected: string): {
  matched: number;
  missing: string[];
  extra: string[];
  ratio: number;
} {
  const g = tokenize(guess);
  const e = tokenize(expected);
  const expectedSet = new Set(e);
  const guessSet = new Set(g);
  const meaningful = e.filter((t) => !STOPWORDS.has(t));
  const meaningfulSet = new Set(meaningful);
  const matched = meaningful.filter((t) => guessSet.has(t)).length;
  const missing = Array.from(meaningfulSet).filter((t) => !guessSet.has(t));
  const extra = Array.from(guessSet).filter(
    (t) => !expectedSet.has(t) && !STOPWORDS.has(t),
  );
  const ratio = meaningful.length ? matched / meaningful.length : 0;
  return { matched, missing, extra, ratio };
}

export function WriteMode({ deckId, cards }: WriteModeProps) {
  const ordered = useMemo(() => {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [cards]);
  const [position, setPosition] = useState(0);
  const [guess, setGuess] = useState("");
  const [state, setState] = useState<"typing" | "scored" | "revealed">("typing");
  const [score, setScore] = useState<ReturnType<typeof tokenOverlap> | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [right, setRight] = useState(0);
  const [partial, setPartial] = useState(0);
  const [wrong, setWrong] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [startedAt] = useState(() => Date.now());
  const [resetKey, setResetKey] = useState(0);

  const card = ordered[position];
  const finished = position >= ordered.length;

  useEffect(() => {
    if (state === "typing") ref.current?.focus();
  }, [state, position]);

  const submit = () => {
    if (!card) return;
    const result = tokenOverlap(guess, card.answer);
    setScore(result);
    setState("scored");
  };

  const accept = (grade: "good" | "hard" | "again") => {
    if (!card) return;
    if (grade === "good") {
      setRight((r) => r + 1);
      scheduleGrade(deckId, card.id, "good");
      recordReview("good");
    } else if (grade === "hard") {
      setPartial((p) => p + 1);
      scheduleGrade(deckId, card.id, "hard");
      recordReview("hard");
    } else {
      setWrong((w) => w + 1);
      scheduleGrade(deckId, card.id, "again");
      recordReview("again");
    }
    if (confidence != null) {
      logConfidence({ deck_id: deckId, card_id: card.id, predicted: confidence, actual: grade });
    }
    setPosition((p) => p + 1);
    setGuess("");
    setScore(null);
    setConfidence(null);
    setState("typing");
  };

  const reveal = () => {
    if (!card) return;
    setState("revealed");
    setWrong((w) => w + 1);
    scheduleGrade(deckId, card.id, "hard");
    recordReview("hard");
  };

  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipe(swipeRef, {
    onSwipeRight: () => {
      if (state === "scored" || state === "revealed") accept("good");
    },
    onSwipeLeft: () => {
      if (state === "scored" || state === "revealed") accept("again");
    },
  });

  if (finished || !card) {
    return (
      <SessionSummary
        total={right + partial + wrong}
        correct={right + partial}
        again={wrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setRight(0);
          setPartial(0);
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
            Card {position + 1} of {ordered.length}
          </span>
          <span>
            {right} right - {partial} partial - {wrong} missed
          </span>
        </div>
        <Progress value={(position / ordered.length) * 100} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={position}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Card className="paper">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Write the answer</Badge>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Free recall
                </p>
              </div>
              <p className="text-balance font-display text-2xl font-medium leading-snug sm:text-3xl">
                {card.question}
              </p>

              {state === "typing" && (
                <>
                  <ConfidenceRating value={confidence} onChange={setConfidence} />
                  <Textarea
                    ref={ref}
                    rows={3}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Write the answer in your own words"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MicButton onTranscript={(t) => setGuess(t)} />
                      <p className="text-xs text-muted-foreground">
                        Cmd/Ctrl+Enter to submit.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={reveal}>
                        <Eye className="h-4 w-4" /> Reveal
                      </Button>
                      <Button onClick={submit} disabled={!guess.trim()}>
                        <Check className="h-4 w-4" /> Submit
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {(state === "scored" || state === "revealed") && (
                <div className="space-y-3 rounded-lg border bg-secondary/40 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Expected answer</p>
                    {score && (
                      <Badge
                        variant="outline"
                        className={cn(
                          score.ratio >= 0.8
                            ? "border-success text-success"
                            : score.ratio >= 0.5
                            ? "border-warn text-warn"
                            : "border-destructive text-destructive",
                        )}
                      >
                        {Math.round((score?.ratio ?? 0) * 100)}% match
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">{card.answer}</p>
                  {state === "scored" && score && (
                    <>
                      <p className="font-medium">Your answer</p>
                      <p className="text-muted-foreground">{guess}</p>
                      <div className="grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <p className="font-medium text-foreground">Missing key terms</p>
                          {score.missing.length === 0 ? (
                            <p className="text-success">None.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {score.missing.slice(0, 8).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Extra words</p>
                          {score.extra.length === 0 ? (
                            <p className="text-muted-foreground">None.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {score.extra.slice(0, 8).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-warn/10 px-2 py-0.5 text-warn"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => accept("again")}>
                      <X className="h-4 w-4" /> Got it wrong
                    </Button>
                    <Button variant="outline" onClick={() => accept("hard")}>
                      Partial
                    </Button>
                    <Button onClick={() => accept("good")}>
                      <Check className="h-4 w-4" /> Got it
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
