"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Eye,
  FileText,
  ListChecks,
  Play,
  Repeat,
  RotateCcw,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Certificate } from "@/components/certificate";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

type Format = "mc" | "cloze" | "open";

interface Question {
  card: ResolvedCard;
  format: Format;
  options?: string[];
  clozeBefore?: string;
  clozeAfter?: string;
  clozeTarget?: string;
}

interface Answer {
  picked?: number;
  text?: string;
  graded?: "correct" | "partial" | "wrong";
}

interface TestState {
  questions: Question[];
  answers: Record<string, Answer>;
  startedAt: number;
  durationSec: number;
  position: number;
  finished: boolean;
}

interface TestModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuestion(card: ResolvedCard, allAnswers: string[], format: Format): Question {
  if (format === "mc") {
    const distractors = shuffle(allAnswers.filter((a) => a !== card.answer)).slice(0, 3);
    while (distractors.length < 3) distractors.push("(no other option)");
    return { card, format, options: shuffle([card.answer, ...distractors]) };
  }
  if (format === "cloze") {
    if (card.source_fact) {
      const re = new RegExp(`\\b${escapeRegex(card.answer.trim())}\\b`, "i");
      const m = card.source_fact.match(re);
      if (m) {
        const idx = m.index ?? -1;
        if (idx >= 0) {
          return {
            card,
            format,
            clozeBefore: card.source_fact.slice(0, idx),
            clozeAfter: card.source_fact.slice(idx + m[0].length),
            clozeTarget: m[0],
          };
        }
      }
    }
    // Fallback to open if we can't build a cloze.
    return { card, format: "open" };
  }
  return { card, format: "open" };
}

function buildTest(cards: ResolvedCard[], n: number, mix: "balanced" | "mc" | "cloze" | "open"): Question[] {
  const allAnswers = cards.map((c) => c.answer);
  const picked = shuffle(cards).slice(0, n);
  return picked.map((card, idx) => {
    let fmt: Format;
    if (mix === "mc") fmt = "mc";
    else if (mix === "cloze") fmt = "cloze";
    else if (mix === "open") fmt = "open";
    else fmt = (["mc", "cloze", "open"] as Format[])[idx % 3];
    return buildQuestion(card, allAnswers, fmt);
  });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’']/g, "'").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function TestMode({ deckId, cards }: TestModeProps) {
  const [config, setConfig] = useState<{ count: number; durationMin: number; mix: "balanced" | "mc" | "cloze" | "open" } | null>(null);
  const [state, setState] = useState<TestState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!state || state.finished) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const startTest = (count: number, durationMin: number, mix: "balanced" | "mc" | "cloze" | "open") => {
    const qs = buildTest(cards, count, mix);
    setConfig({ count, durationMin, mix });
    setState({
      questions: qs,
      answers: {},
      startedAt: Date.now(),
      durationSec: durationMin * 60,
      position: 0,
      finished: false,
    });
  };

  if (!state || !config) {
    return <TestSetup cards={cards} onStart={startTest} />;
  }

  const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
  const remainingSec = Math.max(0, state.durationSec - elapsedSec);
  const timeUp = remainingSec === 0;

  if (timeUp && !state.finished) {
    setTimeout(() => setState((s) => (s ? { ...s, finished: true } : null)), 0);
  }

  if (state.finished) {
    return (
      <TestResults
        state={state}
        deckId={deckId}
        onRestart={() => {
          setState(null);
          setConfig(null);
        }}
      />
    );
  }

  const q = state.questions[state.position];
  const totalQ = state.questions.length;
  const positionPct = Math.round(((state.position + (state.answers[q.card.id] ? 1 : 0)) / totalQ) * 100);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;

  const answerCurrent = (patch: Partial<Answer>) => {
    setState((s) => {
      if (!s) return s;
      const next = { ...s.answers, [q.card.id]: { ...(s.answers[q.card.id] ?? {}), ...patch } };
      return { ...s, answers: next };
    });
  };

  const gradeMC = (pickedIdx: number) => {
    const correct = q.options ? q.options[pickedIdx] === q.card.answer : false;
    answerCurrent({ picked: pickedIdx, graded: correct ? "correct" : "wrong" });
    if (correct) scheduleGrade(deckId, q.card.id, "good");
    else scheduleGrade(deckId, q.card.id, "again");
    recordReview(correct ? "good" : "again");
  };

  const gradeOpen = (selfGrade: "correct" | "partial" | "wrong") => {
    const text = state.answers[q.card.id]?.text ?? "";
    answerCurrent({ text, graded: selfGrade });
    if (selfGrade === "correct") scheduleGrade(deckId, q.card.id, "good");
    else if (selfGrade === "partial") scheduleGrade(deckId, q.card.id, "hard");
    else scheduleGrade(deckId, q.card.id, "again");
    recordReview(selfGrade === "correct" ? "good" : selfGrade === "partial" ? "hard" : "again");
  };

  const advance = () => {
    if (state.position >= totalQ - 1) {
      setState((s) => (s ? { ...s, finished: true } : null));
    } else {
      setState((s) => (s ? { ...s, position: s.position + 1 } : null));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Test
            </Badge>
            <p className="text-sm">
              Question <span className="font-semibold">{state.position + 1}</span> /{" "}
              <span className="text-muted-foreground">{totalQ}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <Clock className={cn("h-4 w-4", remainingSec < 60 && "text-destructive animate-pulse")} />
              <span className={cn(remainingSec < 60 && "font-semibold text-destructive")}>
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState((s) => (s ? { ...s, finished: true } : null))}
            >
              End test
            </Button>
          </div>
        </CardContent>
      </Card>
      <Progress value={positionPct} className="h-1.5" />

      <AnimatePresence mode="wait">
        <motion.div
          key={state.position}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {q.format === "mc" && <MCQuestion q={q} answer={state.answers[q.card.id]} onPick={gradeMC} />}
          {q.format === "cloze" && (
            <ClozeQuestion
              q={q}
              answer={state.answers[q.card.id]}
              onSubmit={(text) => {
                const right = q.clozeTarget && normalize(text) === normalize(q.clozeTarget);
                answerCurrent({ text, graded: right ? "correct" : "wrong" });
                if (right) {
                  scheduleGrade(deckId, q.card.id, "good");
                  recordReview("good");
                } else {
                  scheduleGrade(deckId, q.card.id, "again");
                  recordReview("again");
                }
              }}
            />
          )}
          {q.format === "open" && (
            <OpenQuestion
              q={q}
              answer={state.answers[q.card.id]}
              onWrite={(text) => answerCurrent({ text })}
              onGrade={gradeOpen}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end">
        <Button onClick={advance} disabled={!state.answers[q.card.id]?.graded}>
          {state.position >= totalQ - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MCQuestion({
  q,
  answer,
  onPick,
}: {
  q: Question;
  answer?: Answer;
  onPick: (i: number) => void;
}) {
  return (
    <Card className="paper">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="gap-1">
            <ListChecks className="h-3 w-3" /> Multiple choice
          </Badge>
        </div>
        <p className="font-display text-xl font-medium sm:text-2xl">{q.card.question}</p>
        <div className="grid gap-2">
          {(q.options ?? []).map((opt, idx) => {
            const isCorrect = opt === q.card.answer;
            const isPicked = answer?.picked === idx;
            const done = answer?.graded != null;
            return (
              <button
                key={idx}
                type="button"
                disabled={done}
                onClick={() => onPick(idx)}
                className={cn(
                  "flex items-center justify-between rounded-lg border bg-background p-3 text-left text-sm transition-all",
                  !done && "hover:border-primary/60 hover:bg-primary/5",
                  done && isCorrect && "border-success bg-success/10",
                  done && !isCorrect && isPicked && "border-destructive bg-destructive/10",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-medium">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </span>
                {done && isCorrect && <Check className="h-4 w-4 text-success" />}
                {done && isPicked && !isCorrect && <X className="h-4 w-4 text-destructive" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ClozeQuestion({
  q,
  answer,
  onSubmit,
}: {
  q: Question;
  answer?: Answer;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(answer?.text ?? "");
  const done = answer?.graded != null;
  return (
    <Card className="paper">
      <CardContent className="space-y-5 p-6">
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" /> Fill in the blank
        </Badge>
        <p className="text-balance font-display text-xl leading-relaxed sm:text-2xl">
          <span>{q.clozeBefore}</span>
          {done ? (
            answer?.graded === "correct" ? (
              <span className="mx-1 rounded-md bg-success/15 px-1.5 py-0.5 text-success">
                {q.clozeTarget}
              </span>
            ) : (
              <span className="mx-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-destructive">
                {q.clozeTarget}
              </span>
            )
          ) : (
            <span className="mx-1 inline-block min-w-[6ch] border-b-2 border-primary/60" />
          )}
          <span>{q.clozeAfter}</span>
        </p>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type the missing word"
            disabled={done}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) onSubmit(text.trim());
            }}
          />
          <Button onClick={() => text.trim() && onSubmit(text.trim())} disabled={done || !text.trim()}>
            <Check className="h-4 w-4" /> Submit
          </Button>
        </div>
        {done && answer?.graded === "wrong" && (
          <p className="text-sm text-muted-foreground">
            Expected: <span className="font-medium text-foreground">{q.clozeTarget}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OpenQuestion({
  q,
  answer,
  onWrite,
  onGrade,
}: {
  q: Question;
  answer?: Answer;
  onWrite: (text: string) => void;
  onGrade: (g: "correct" | "partial" | "wrong") => void;
}) {
  const [text, setText] = useState(answer?.text ?? "");
  const [revealed, setRevealed] = useState(false);
  const done = answer?.graded != null;
  return (
    <Card className="paper">
      <CardContent className="space-y-5 p-6">
        <Badge variant="outline" className="gap-1">
          <Repeat className="h-3 w-3" /> Open question
        </Badge>
        <p className="text-balance font-display text-xl font-medium sm:text-2xl">{q.card.question}</p>
        <textarea
          rows={3}
          value={text}
          disabled={done}
          onChange={(e) => {
            setText(e.target.value);
            onWrite(e.target.value);
          }}
          placeholder="Your answer"
          className="w-full rounded-md border bg-background p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {(revealed || done) && (
          <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
            <p className="font-medium">Expected</p>
            <p className="mt-1 text-muted-foreground">{q.card.answer}</p>
          </div>
        )}
        {!done && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRevealed(true)}>
              <Eye className="h-4 w-4" /> Reveal expected
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onGrade("wrong")}>
                Wrong
              </Button>
              <Button variant="outline" onClick={() => onGrade("partial")}>
                Partial
              </Button>
              <Button onClick={() => onGrade("correct")}>
                Correct <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestSetup({
  cards,
  onStart,
}: {
  cards: ResolvedCard[];
  onStart: (count: number, durationMin: number, mix: "balanced" | "mc" | "cloze" | "open") => void;
}) {
  const [count, setCount] = useState(Math.min(10, cards.length));
  const [duration, setDuration] = useState(15);
  const [mix, setMix] = useState<"balanced" | "mc" | "cloze" | "open">("balanced");
  const maxCount = Math.min(50, cards.length);
  if (cards.length < 3) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-display">Need at least 3 cards</CardTitle>
          <CardDescription>
            Test mode needs a few cards to draw distractors from. Generate a bigger deck first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" /> Set up your test
        </CardTitle>
        <CardDescription>
          A mixed-format exam over your deck. Multiple choice, cloze, and open questions, scored at the end.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Number of questions</Label>
            <span className="font-mono text-sm">{count}</span>
          </div>
          <Slider
            value={[count]}
            min={3}
            max={maxCount}
            step={1}
            onValueChange={(v) => setCount(v[0])}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Time limit (minutes)</Label>
            <span className="font-mono text-sm">{duration}</span>
          </div>
          <Slider
            value={[duration]}
            min={2}
            max={60}
            step={1}
            onValueChange={(v) => setDuration(v[0])}
          />
        </div>
        <div className="space-y-2">
          <Label>Question mix</Label>
          <Select value={mix} onValueChange={(v) => setMix(v as typeof mix)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced (mix of MC, cloze, open)</SelectItem>
              <SelectItem value="mc">Multiple choice only</SelectItem>
              <SelectItem value="cloze">Cloze (fill-in-the-blank) only</SelectItem>
              <SelectItem value="open">Open-ended only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">Heads up</p>
          <p className="mt-0.5">
            Once you start, the timer runs. You can end the test early; you can't pause.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => onStart(count, duration, mix)}>
          <Play className="h-4 w-4" /> Start test
        </Button>
      </CardContent>
    </Card>
  );
}

function TestResults({
  state,
  deckId,
  onRestart,
}: {
  state: TestState;
  deckId: string;
  onRestart: () => void;
}) {
  const total = state.questions.length;
  const right = state.questions.filter((q) => state.answers[q.card.id]?.graded === "correct").length;
  const partial = state.questions.filter((q) => state.answers[q.card.id]?.graded === "partial").length;
  const wrong = state.questions.filter((q) => state.answers[q.card.id]?.graded === "wrong").length;
  const unanswered = total - right - partial - wrong;
  const pct = Math.round(((right + partial * 0.5) / total) * 100);
  const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-400/30 via-yellow-400/20 to-orange-400/30">
        <CardContent className="grid items-center gap-6 p-8 md:grid-cols-[1fr_auto]">
          <div>
            <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-200">
              <Trophy className="h-3.5 w-3.5" /> Test complete
            </Badge>
            <h2 className="mt-2 font-display text-3xl font-semibold">
              {pct >= 90 ? "Outstanding." : pct >= 70 ? "Solid work." : pct >= 50 ? "Keep going." : "Worth another pass."}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {right} of {total} fully correct in {min}m {sec}s.
            </p>
          </div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.1 }}
            className="grid h-32 w-32 place-items-center rounded-full bg-card shadow-lg ring-4 ring-amber-400/40"
          >
            <div className="text-center">
              <p className="font-display text-4xl font-bold">{pct}%</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
            </div>
          </motion.div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Correct" value={right} tone="success" />
        <Tile label="Partial" value={partial} tone="warn" />
        <Tile label="Wrong" value={wrong} tone="destructive" />
        <Tile label="Skipped" value={unanswered} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Question breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.questions.map((q, i) => {
            const grade = state.answers[q.card.id]?.graded;
            const icon =
              grade === "correct" ? (
                <Check className="h-4 w-4 text-success" />
              ) : grade === "partial" ? (
                <Award className="h-4 w-4 text-warn" />
              ) : grade === "wrong" ? (
                <X className="h-4 w-4 text-destructive" />
              ) : (
                <CircleAlert className="h-4 w-4 text-muted-foreground" />
              );
            return (
              <div key={q.card.id + i} className="flex items-start gap-3 rounded-md border p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{q.card.question}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{q.card.answer}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {q.format === "mc" ? "MC" : q.format}
                </Badge>
                {icon}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {pct >= 60 && (
        <Certificate
          deckName={state.questions[0]?.card.id ? `Deck ${state.questions[0].card.id.slice(0, 6)}` : "Deck"}
          scorePct={pct}
          totalQuestions={total}
          duration={`${min}m ${sec}s`}
        />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" /> New test
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/decks/${deckId}` as any}>Back to deck</Link>
        </Button>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "success" | "warn" | "destructive" | "muted" }) {
  const tones = {
    success: "border-success/40 bg-success/5 text-success",
    warn: "border-warn/40 bg-warn/5 text-warn",
    destructive: "border-destructive/40 bg-destructive/5 text-destructive",
    muted: "border-muted bg-muted/40 text-muted-foreground",
  } as const;
  return (
    <div className={cn("rounded-lg border p-4 text-center", tones[tone])}>
      <p className="font-display text-3xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-wide">{label}</p>
    </div>
  );
}
