"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleAlert, Headphones, Mic, MicOff, Pause, Play, Volume2 } from "lucide-react";
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
import { loadLocale } from "@/lib/i18n";
import type { ResolvedCard } from "@/lib/cards";

// Fully hands-free: TTS speaks the question, listens for the spoken answer,
// scores by token overlap, TTS confirms, advances. Identical surface area to
// Listen mode but eliminates the per-card grade tap by auto-grading.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’']/g, "'").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(guess: string, expected: string): number {
  const g = new Set(normalize(guess).split(" ").filter(Boolean));
  const e = normalize(expected).split(" ").filter((t) => t.length > 2);
  if (e.length === 0) return 0;
  let hit = 0;
  for (const t of e) if (g.has(t)) hit += 1;
  return hit / e.length;
}

interface VoiceOnlyModeProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function VoiceOnlyMode({ deckId, cards }: VoiceOnlyModeProps) {
  const supportsTTS = speechAvailable();
  const supportsSR = speechRecognitionAvailable();
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<"speaking-q" | "listening" | "speaking-a">("speaking-q");
  const [paused, setPaused] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [score, setScore] = useState<number | null>(null);
  const { listening, transcript, error: srError, start, stop, setTranscript } = useSpeechRecognition();

  const card = cards[position];
  const finished = position >= cards.length;

  const advance = useCallback(() => {
    setTranscript("");
    setScore(null);
    setPhase("speaking-q");
    setPosition((p) => p + 1);
  }, [setTranscript]);

  // Speak question -> listen -> auto-grade -> speak answer -> next.
  useEffect(() => {
    if (!card || paused || finished) return;
    if (phase === "speaking-q") {
      const locale = loadLocale();
      const ttsLang = locale === "es" ? "es-ES" : "en-US";
      if (supportsTTS) speak(card.question, { rate: 0.95, lang: ttsLang });
      const ms = Math.max(2500, card.question.length * 70);
      const t = window.setTimeout(() => {
        if (supportsSR) start({ lang: locale === "es" ? "es-ES" : navigator.language });
        setPhase("listening");
      }, ms);
      return () => window.clearTimeout(t);
    }
    if (phase === "listening") {
      const t = window.setTimeout(() => {
        stop();
        const s = card ? tokenOverlap(transcript, card.answer) : 0;
        setScore(s);
        const grade = s >= 0.7 ? "good" : s >= 0.4 ? "hard" : "again";
        scheduleGrade(deckId, card.id, grade);
        recordReview(grade);
        recordTagGrade([...card.tags, ...card.customTags], grade);
        if (grade === "again") setWrong((w) => w + 1);
        else setCorrect((c) => c + 1);
        setPhase("speaking-a");
      }, 6500);
      return () => window.clearTimeout(t);
    }
    if (phase === "speaking-a") {
      if (supportsTTS) {
        const locale = loadLocale();
        const ttsLang = locale === "es" ? "es-ES" : "en-US";
        const verdict = score == null
          ? ""
          : locale === "es"
          ? (score >= 0.7 ? "Correcto." : score >= 0.4 ? "Parcial." : "No del todo.")
          : (score >= 0.7 ? "Correct." : score >= 0.4 ? "Partial." : "Not quite.");
        const prefix = locale === "es" ? "La respuesta es" : "The answer is";
        speak(`${verdict} ${prefix}. ${card.answer}`, { rate: 0.95, lang: ttsLang });
      }
      const ms = Math.max(2500, card.answer.length * 70);
      const t = window.setTimeout(advance, ms);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, phase, paused, finished, supportsTTS, supportsSR]);

  useEffect(() => () => stopSpeaking(), []);

  if (!supportsTTS) {
    return (
      <Card className="border-warn/40 bg-warn/5">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-medium text-warn">
            <CircleAlert className="h-4 w-4" /> No speech synthesis here
          </p>
          <p className="text-muted-foreground">
            Voice-only needs the browser's Web Speech API (Chrome/Edge/Safari).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (srError === "permission") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <CircleAlert className="h-4 w-4" /> Microphone permission denied
          </p>
          <p className="text-muted-foreground">
            Voice-only auto-grades by listening to your spoken answer. Allow
            the mic in your browser's site settings and reload, or switch to
            Listen mode (no mic needed).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (srError === "audio") {
    return (
      <Card className="border-warn/40 bg-warn/5">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-medium text-warn">
            <CircleAlert className="h-4 w-4" /> No microphone detected
          </p>
          <p className="text-muted-foreground">
            Connect a mic, or switch to Listen mode for hands-free without
            auto-grading.
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
        }}
      />
    );
  }

  return (
    <div className="space-y-5" role="region" aria-label="Hands-free voice study session">
      <div className="flex justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>Card {position + 1} of {cards.length}</span>
        <span>
          <span className="sr-only">Score:</span> {correct} correct, {wrong} wrong
        </span>
      </div>
      <Progress value={(position / cards.length) * 100} />
      <Card>
        <CardContent className="space-y-5 p-6 text-center">
          <Badge variant="outline" className="gap-1.5">
            <Headphones className="h-3.5 w-3.5" /> Voice-only
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
                  <Pulse icon={Volume2} />
                  <p className="text-sm text-muted-foreground">"{card.question}"</p>
                </>
              )}
              {phase === "listening" && (
                <>
                  <Pulse icon={listening ? Mic : MicOff} accent="text-rose-500" />
                  <p className="min-h-[1.5em] text-sm font-medium">{transcript || "(listening...)"}</p>
                </>
              )}
              {phase === "speaking-a" && (
                <>
                  <Pulse icon={Volume2} />
                  <p className="font-display text-xl font-medium">{card.answer}</p>
                  {score != null && (
                    <Badge variant="outline" className="mx-auto">
                      Match {Math.round(score * 100)}% - auto-graded
                    </Badge>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <Button variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
        </CardContent>
      </Card>
      {!supportsSR && (
        <p className="text-center text-xs text-muted-foreground">
          (Voice recognition not supported. The session will still speak Q + A but won't score.)
        </p>
      )}
    </div>
  );
}

function Pulse({ icon: Icon, accent }: { icon: any; accent?: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className={`grid mx-auto h-16 w-16 place-items-center rounded-full bg-primary/10 ${accent || "text-primary"}`}
    >
      <Icon className="h-7 w-7" />
    </motion.div>
  );
}
