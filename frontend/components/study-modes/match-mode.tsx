"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, RotateCcw, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionSummary } from "@/components/session-summary";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import type { ResolvedCard } from "@/lib/cards";
import { cn, truncate } from "@/lib/utils";

interface MatchModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

interface Tile {
  id: string;
  cardId: string;
  side: "q" | "a";
  text: string;
  matched: boolean;
  wrongFlash: boolean;
}

const BATCH = 6;

function buildTiles(batch: ResolvedCard[]): Tile[] {
  const tiles: Tile[] = [];
  for (const c of batch) {
    tiles.push({
      id: `${c.id}::q`,
      cardId: c.id,
      side: "q",
      text: c.question,
      matched: false,
      wrongFlash: false,
    });
    tiles.push({
      id: `${c.id}::a`,
      cardId: c.id,
      side: "a",
      text: c.answer,
      matched: false,
      wrongFlash: false,
    });
  }
  return tiles;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function MatchMode({ deckId, cards }: MatchModeProps) {
  const batches = useMemo<ResolvedCard[][]>(() => {
    const groups: ResolvedCard[][] = [];
    const shuffled = shuffle(cards);
    for (let i = 0; i < shuffled.length; i += BATCH) {
      groups.push(shuffled.slice(i, i + BATCH));
    }
    return groups;
  }, [cards]);

  const [batchIdx, setBatchIdx] = useState(0);
  const [questions, setQuestions] = useState<Tile[]>([]);
  const [answers, setAnswers] = useState<Tile[]>([]);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [matches, setMatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const batch = batches[batchIdx];
    if (!batch) return;
    const tiles = buildTiles(batch);
    setQuestions(shuffle(tiles.filter((t) => t.side === "q")));
    setAnswers(shuffle(tiles.filter((t) => t.side === "a")));
    setSelectedQ(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchIdx, resetKey]);

  const tryMatch = useCallback(
    (qId: string, aId: string) => {
      const q = questions.find((t) => t.id === qId);
      const a = answers.find((t) => t.id === aId);
      if (!q || !a) return;
      const correct = q.cardId === a.cardId;
      if (correct) {
        setMatches((m) => m + 1);
        scheduleGrade(deckId, q.cardId, "good");
        recordReview("good");
        setQuestions((cur) =>
          cur.map((t) => (t.id === qId ? { ...t, matched: true } : t)),
        );
        setAnswers((cur) =>
          cur.map((t) => (t.id === aId ? { ...t, matched: true } : t)),
        );
      } else {
        setMisses((m) => m + 1);
        scheduleGrade(deckId, q.cardId, "again");
        recordReview("again");
        setQuestions((cur) =>
          cur.map((t) => (t.id === qId ? { ...t, wrongFlash: true } : t)),
        );
        setAnswers((cur) =>
          cur.map((t) => (t.id === aId ? { ...t, wrongFlash: true } : t)),
        );
        setTimeout(() => {
          setQuestions((cur) =>
            cur.map((t) => (t.id === qId ? { ...t, wrongFlash: false } : t)),
          );
          setAnswers((cur) =>
            cur.map((t) => (t.id === aId ? { ...t, wrongFlash: false } : t)),
          );
        }, 450);
      }
      setSelectedQ(null);
    },
    [deckId, questions, answers],
  );

  const allMatched =
    questions.length > 0 && questions.every((t) => t.matched);
  const allDone = batchIdx >= batches.length - 1 && allMatched;

  useEffect(() => {
    if (!allMatched || allDone) return;
    const t = setTimeout(() => setBatchIdx((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [allMatched, allDone]);

  if (allDone) {
    return (
      <SessionSummary
        total={matches + misses}
        correct={matches}
        again={misses}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setBatchIdx(0);
          setMatches(0);
          setMisses(0);
          setSelectedQ(null);
          setResetKey((k) => k + 1);
        }}
      />
    );
  }

  const total = batches.length * BATCH;
  const matchedSoFar = batchIdx * BATCH + questions.filter((t) => t.matched).length;
  const pct = total ? Math.round((matchedSoFar / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Round {batchIdx + 1} of {batches.length}
          </span>
          <span>
            {matches} matched - {misses} mismatched
          </span>
        </div>
        <Progress value={pct} />
      </div>

      <Card className="paper">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" /> Match
            </Badge>
            <p className="text-xs text-muted-foreground">
              Tap a question, then tap its answer.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Questions</p>
              <AnimatePresence mode="popLayout">
                {questions.map((q) =>
                  q.matched ? null : (
                    <motion.button
                      key={q.id}
                      layout
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: q.wrongFlash
                          ? "hsla(0, 84%, 60%, 0.15)"
                          : selectedQ === q.id
                          ? "hsla(250, 75%, 60%, 0.1)"
                          : "hsl(var(--card))",
                      }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      onClick={() => setSelectedQ(q.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-sm transition-colors",
                        selectedQ === q.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "hover:border-primary/40",
                        q.wrongFlash && "border-destructive/60",
                      )}
                    >
                      {truncate(q.text, 140)}
                    </motion.button>
                  ),
                )}
              </AnimatePresence>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Answers</p>
              <AnimatePresence mode="popLayout">
                {answers.map((a) =>
                  a.matched ? null : (
                    <motion.button
                      key={a.id}
                      layout
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: a.wrongFlash
                          ? "hsla(0, 84%, 60%, 0.15)"
                          : "hsl(var(--card))",
                      }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      disabled={!selectedQ}
                      onClick={() => selectedQ && tryMatch(selectedQ, a.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-sm transition-colors",
                        selectedQ ? "hover:border-success/60" : "opacity-60",
                        a.wrongFlash && "border-destructive/60",
                      )}
                    >
                      {truncate(a.text, 180)}
                    </motion.button>
                  ),
                )}
              </AnimatePresence>
            </div>
          </div>
          {allMatched && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 rounded-md bg-success/10 p-3 text-sm font-medium text-success"
            >
              <CheckCircle2 className="h-4 w-4" /> Round clear. Loading next batch...
            </motion.div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        <span>{Math.floor((Date.now() - startedAt) / 1000)}s elapsed</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setBatchIdx(0);
            setMatches(0);
            setMisses(0);
            setSelectedQ(null);
            setResetKey((k) => k + 1);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restart
        </Button>
      </div>
    </div>
  );
}
