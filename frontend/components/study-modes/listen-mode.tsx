"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CircleAlert,
  Headphones,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionSummary } from "@/components/session-summary";
import { speak, speechAvailable, stopSpeaking } from "@/lib/speech";
import { speechRecognitionAvailable, useSpeechRecognition } from "@/lib/speech-recognition";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import { recordTagGrade } from "@/lib/tag-stats";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

interface ListenModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

type Phase = "speaking-q" | "listening" | "speaking-a" | "grading";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’']/g, "'")
    .replace(/[“”"]/g, '"')
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(guess: string, expected: string): number {
  const g = new Set(normalize(guess).split(" ").filter(Boolean));
  const e = normalize(expected).split(" ").filter((t) => t.length > 2);
  if (e.length === 0) return 0;
  let hit = 0;
  for (const t of e) if (g.has(t)) hit += 1;
  return hit / e.length;
}

export function ListenMode({ deckId, cards }: ListenModeProps) {
  const supportsTTS = speechAvailable();
  const supportsSR = speechRecognitionAvailable();

  const order = useMemo(() => {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [cards]);

  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<Phase>("speaking-q");
  const [paused, setPaused] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [autoScore, setAutoScore] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const { listening, transcript, interim, start, stop, setTranscript } = useSpeechRecognition();
  const ttsRef = useRef<number | null>(null);

  const card = order[position];
  const finished = position >= order.length;

  const advance = useCallback(() => {
    setTranscript("");
    setAutoScore(null);
    setPhase("speaking-q");
    setPosition((p) => p + 1);
  }, [setTranscript]);

  const grade = useCallback(
    (g: "good" | "again" | "hard") => {
      if (!card) return;
      if (g === "good") {
        setCorrect((c) => c + 1);
        scheduleGrade(deckId, card.id, "good");
        recordReview("good");
        recordTagGrade([...card.tags, ...card.customTags], "good");
      } else if (g === "hard") {
        setCorrect((c) => c + 1);
        scheduleGrade(deckId, card.id, "hard");
        recordReview("hard");
        recordTagGrade([...card.tags, ...card.customTags], "hard");
      } else {
        setWrong((w) => w + 1);
        scheduleGrade(deckId, card.id, "again");
        recordReview("again");
        recordTagGrade([...card.tags, ...card.customTags], "again");
      }
      advance();
    },
    [card, deckId, advance],
  );

  // Speak the question, then listen.
  useEffect(() => {
    if (!card || paused || finished) return;
    if (phase === "speaking-q") {
      if (supportsTTS) {
        speak(card.question, { rate: 0.95 });
      }
      const ms = Math.max(2200, card.question.length * 60);
      const t = window.setTimeout(() => {
        setPhase(supportsSR ? "listening" : "speaking-a");
        if (supportsSR) start();
      }, ms);
      ttsRef.current = t;
      return () => window.clearTimeout(t);
    }
    if (phase === "speaking-a") {
      if (supportsTTS) {
        speak(`The answer is. ${card.answer}`, { rate: 0.95 });
      }
      const ms = Math.max(2200, card.answer.length * 60);
      const t = window.setTimeout(() => setPhase("grading"), ms);
      ttsRef.current = t;
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, paused, phase, finished, supportsTTS, supportsSR]);

  // Once user stops talking (or after 6s of listening), score the transcript.
  useEffect(() => {
    if (phase !== "listening") return;
    const t = window.setTimeout(() => {
      stop();
      const score = card ? tokenOverlap(transcript, card.answer) : 0;
      setAutoScore(score);
      setPhase("speaking-a");
    }, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  const togglePause = () => {
    if (paused) {
      setPaused(false);
      return;
    }
    setPaused(true);
    stopSpeaking();
    if (ttsRef.current) window.clearTimeout(ttsRef.current);
  };

  if (!supportsTTS) {
    return (
      <Card className="border-warn/40 bg-warn/5">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-medium text-warn">
            <CircleAlert className="h-4 w-4" /> No speech synthesis here
          </p>
          <p className="text-muted-foreground">
            Listen mode needs the browser's Web Speech API (Chrome, Edge, Safari).
            Your browser doesn't expose it, so this mode can't run.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (finished || !card) {
    return (
      <SessionSummary
        total={correct + wrong}
        correct={correct}
        again={wrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setCorrect(0);
          setWrong(0);
          setPhase("speaking-q");
          setResetKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-5" key={resetKey}>
      <div className="space-y-1">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Card {position + 1} of {order.length}
          </span>
          <span>
            {correct} - {wrong}
          </span>
        </div>
        <Progress value={(position / order.length) * 100} />
      </div>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8 text-center">
          <Badge variant="outline" className="gap-1.5">
            <Headphones className="h-3.5 w-3.5" /> Listen mode
          </Badge>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${position}-${phase}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2"
            >
              {phase === "speaking-q" && (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Listening to question
                  </p>
                  <PulsingIcon icon={Volume2} />
                  <p className="text-sm text-muted-foreground">"{card.question}"</p>
                </>
              )}
              {phase === "listening" && (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Your turn - speak the answer
                  </p>
                  <PulsingIcon icon={listening ? Mic : MicOff} colorClass={listening ? "text-rose-500" : "text-muted-foreground"} />
                  <p className="min-h-[1.5em] text-sm text-foreground">{transcript}</p>
                  {interim && (
                    <p className="text-xs italic text-muted-foreground">{interim}</p>
                  )}
                </>
              )}
              {phase === "speaking-a" && (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reading the answer
                  </p>
                  <PulsingIcon icon={Volume2} />
                  <p className="text-sm font-medium">{card.answer}</p>
                  {autoScore != null && (
                    <p className="text-xs">
                      <Badge
                        variant="outline"
                        className={cn(
                          autoScore >= 0.7
                            ? "border-success text-success"
                            : autoScore >= 0.4
                            ? "border-warn text-warn"
                            : "border-destructive text-destructive",
                        )}
                      >
                        Voice match: {Math.round(autoScore * 100)}%
                      </Badge>
                    </p>
                  )}
                </>
              )}
              {phase === "grading" && (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Grade yourself
                  </p>
                  <p className="font-display text-xl font-medium">{card.answer}</p>
                  {autoScore != null && (
                    <Badge variant="outline" className="mx-auto">
                      Voice match: {Math.round(autoScore * 100)}%
                    </Badge>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {phase === "grading" && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => grade("again")}>
                <X className="h-4 w-4" /> Missed
              </Button>
              <Button variant="outline" className="border-warn/40 text-warn" onClick={() => grade("hard")}>
                Partial
              </Button>
              <Button onClick={() => grade("good")} className="bg-success text-success-foreground hover:bg-success/90">
                <Check className="h-4 w-4" /> Got it
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={togglePause}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        {phase === "listening" && (
          <Button variant="outline" size="sm" onClick={() => { stop(); setPhase("speaking-a"); }}>
            I'm done speaking
          </Button>
        )}
      </div>

      {!supportsSR && phase === "listening" && (
        <p className="text-center text-xs text-muted-foreground">
          (Voice recognition isn't supported here; we'll just play the answer next.)
        </p>
      )}
    </div>
  );
}

function PulsingIcon({
  icon: Icon,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  colorClass?: string;
}) {
  return (
    <motion.div
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className={cn("grid mx-auto h-16 w-16 place-items-center rounded-full bg-primary/10", colorClass || "text-primary")}
    >
      <Icon className="h-7 w-7" />
    </motion.div>
  );
}
