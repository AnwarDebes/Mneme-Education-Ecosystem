"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronRight,
  CircleAlert,
  Eye,
  GraduationCap,
  Loader2,
  RotateCcw,
  Send,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/mic-button";
import { SessionSummary } from "@/components/session-summary";
import { chatWithDeck } from "@/lib/api";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade } from "@/lib/schedule";
import { recordTagGrade } from "@/lib/tag-stats";
import { renderMarkdown } from "@/lib/markdown";
import { pickVariantQuestion } from "@/lib/card-variants";
import type { ResolvedCard } from "@/lib/cards";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TutorModeProps {
  deckId: string;
  cards: ResolvedCard[];
  model: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function tutorSystemFor(card: ResolvedCard, questionPhrasing: string): string {
  return [
    "You are a Socratic tutor working with a student on ONE specific flashcard.",
    `THE CARD:`,
    `  Question: ${questionPhrasing}`,
    `  Expected answer: ${card.answer}`,
    card.source_fact ? `  Source fact: ${card.source_fact}` : "",
    "",
    "Rules for this conversation:",
    "- The student will attempt the question. Evaluate their answer.",
    "- If they're broadly correct, confirm it warmly and ask a follow-up that probes",
    "  deeper understanding (e.g. an application, a mechanism, an edge case).",
    "- If they're partially correct, name what's right and ask what's missing.",
    "- If they're wrong, do not give the answer yet; give a hint and let them try again.",
    "- After 2-3 turns, either end with a clear confirmation or reveal the expected answer.",
    "- When you are confident the student understands, end your message with the literal token <<DONE>>.",
    "- Keep replies short (under 80 words). Use markdown lists for steps when useful.",
  ].filter(Boolean).join("\n");
}

export function TutorMode({ deckId, cards, model }: TutorModeProps) {
  const shuffled = useMemo(() => {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [cards]);

  const [position, setPosition] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const [resetKey, setResetKey] = useState(0);

  const card = shuffled[position];
  const finished = position >= shuffled.length;
  const questionPhrasing = useMemo(
    () => (card ? pickVariantQuestion(deckId, card.id, card.question) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deckId, card?.id, resetKey],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, pending]);

  useEffect(() => {
    setTurns([]);
    setDone(false);
    setDraft("");
    setError(null);
  }, [position]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || !card || pending || done) return;
    setError(null);
    const nextTurns: Turn[] = [...turns, { role: "user", content: value }];
    setTurns(nextTurns);
    setDraft("");
    setPending(true);
    try {
      const messages: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.content }));
      const resp = await chatWithDeck(deckId, messages, {
        model,
        temperature: 0.4,
        system_append: tutorSystemFor(card, questionPhrasing),
      });
      const isDone = resp.content.includes("<<DONE>>");
      const cleaned = resp.content.replace(/<<DONE>>/g, "").trim();
      setTurns([...nextTurns, { role: "assistant", content: cleaned }]);
      if (isDone) {
        setDone(true);
      }
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPending(false);
    }
  };

  const grade = (g: "right" | "wrong" | "skip") => {
    if (!card) return;
    if (g === "right") {
      setRight((r) => r + 1);
      scheduleGrade(deckId, card.id, "good");
      recordReview("good");
      recordTagGrade([...card.tags, ...card.customTags], "good");
    } else if (g === "wrong") {
      setWrong((w) => w + 1);
      scheduleGrade(deckId, card.id, "again");
      recordReview("again");
      recordTagGrade([...card.tags, ...card.customTags], "again");
    } else {
      setSkipped((s) => s + 1);
    }
    setPosition((p) => p + 1);
  };

  if (finished || !card) {
    return (
      <SessionSummary
        total={right + wrong + skipped}
        correct={right}
        again={wrong}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setPosition(0);
          setRight(0);
          setWrong(0);
          setSkipped(0);
          setResetKey((k) => k + 1);
        }}
      />
    );
  }

  const progressPct = (position / shuffled.length) * 100;

  return (
    <div className="space-y-4" key={resetKey}>
      <div className="space-y-1">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Card {position + 1} of {shuffled.length}
          </span>
          <span>
            {right} got it - {wrong} missed - {skipped} skipped
          </span>
        </div>
        <Progress value={progressPct} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Tutor
            </Badge>
            <p className="text-xs text-muted-foreground">
              The model knows the answer. It will Socratically guide you.
            </p>
          </div>
          <div className="rounded-lg border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Question</p>
            <p className="mt-1 font-display text-xl font-medium leading-snug sm:text-2xl">
              {questionPhrasing}
            </p>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {turns.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-2", t.role === "user" ? "justify-end" : "justify-start")}
                >
                  {t.role === "assistant" && (
                    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      t.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {t.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{t.content}</p>
                    ) : (
                      <div
                        className="space-y-1.5 [&>p]:leading-relaxed [&_code]:rounded [&_code]:bg-card [&_code]:px-1"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(t.content) }}
                      />
                    )}
                  </div>
                  {t.role === "user" && (
                    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                tutor thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <CircleAlert className="h-4 w-4" /> {error}
            </div>
          )}

          {done ? (
            <div className="space-y-3 rounded-md border border-success/40 bg-success/5 p-4">
              <p className="text-sm font-medium text-success">
                The tutor thinks you've got it. Confirm how it actually went:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => grade("right")} className="bg-success text-success-foreground hover:bg-success/90">
                  I got it <ChevronRight className="h-4 w-4" />
                </Button>
                <Button onClick={() => grade("wrong")} variant="outline" className="border-destructive/40 text-destructive">
                  I still struggled
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={draft}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                placeholder="Your answer or follow-up reply"
                disabled={pending}
                className="resize-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MicButton onTranscript={(t) => setDraft(t)} />
                  <p className="text-xs text-muted-foreground">
                    Cmd/Ctrl+Enter sends. Mic supported in Chrome/Edge.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => grade("skip")}>
                    <Eye className="h-4 w-4" /> Skip
                  </Button>
                  <Button onClick={() => send(draft)} disabled={!draft.trim() || pending}>
                    <Send className="h-4 w-4" /> Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => grade("skip")}>
          <RotateCcw className="h-3.5 w-3.5" /> Next card
        </Button>
      </div>
    </div>
  );
}
