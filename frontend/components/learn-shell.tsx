"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Clock,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Lesson {
  id: string;
  title: string;
  intro: string;
  body: { heading: string; text: string }[];
  quiz: { question: string; choices: string[]; correctIndex: number };
}

const LESSONS: Lesson[] = [
  {
    id: "spaced-repetition",
    title: "Why spaced repetition works",
    intro:
      "Forgetting follows a curve. Spaced reviews compress it. This is the foundation of every mode in mneme.",
    body: [
      {
        heading: "The forgetting curve",
        text:
          "Ebbinghaus showed memories decay roughly exponentially. Without review, most new facts are gone within a week.",
      },
      {
        heading: "Spaced practice",
        text:
          "Reviewing right before you would have forgotten flattens the curve. The next interval can be longer than the last because each review strengthens the trace.",
      },
      {
        heading: "Active recall",
        text:
          "Pulling the answer out of your head trains memory better than re-reading. That's why every mneme mode forces retrieval first, feedback second.",
      },
    ],
    quiz: {
      question: "Which is more effective for long-term retention?",
      choices: [
        "Re-reading the textbook chapter four times",
        "Doing one retrieval-practice quiz, then spaced reviews",
        "Highlighting key passages in colored markers",
      ],
      correctIndex: 1,
    },
  },
  {
    id: "interleaving",
    title: "Interleave, don't block",
    intro:
      "Mixing topics within a session feels harder than studying one topic at a time - and that's the point.",
    body: [
      {
        heading: "Blocked practice",
        text:
          "Drilling all the photosynthesis cards back-to-back feels fluent. But fluency is shallow: you're reading off a primed buffer, not retrieving.",
      },
      {
        heading: "Interleaving",
        text:
          "Mixing decks (or modes) within a session means your brain has to retrieve the right schema each time. Slower in the moment, much stronger a week later.",
      },
      {
        heading: "How mneme helps",
        text:
          "Mix decks (Library → Mix decks) and rotate modes (Flip → Quiz → Cloze). The skill tree on /courses also interleaves the order automatically.",
      },
    ],
    quiz: {
      question: "Why does interleaved practice feel harder than blocked?",
      choices: [
        "It requires retrieving the right schema each time, instead of priming one",
        "It uses more screen time",
        "It always involves multiple choice questions",
      ],
      correctIndex: 0,
    },
  },
  {
    id: "fsrs",
    title: "How mneme's scheduler decides what's due",
    intro:
      "The interval between reviews grows each time you grade 'good' or 'easy'; it resets each time you grade 'again'.",
    body: [
      {
        heading: "Ease + interval",
        text:
          "Each card has an ease factor (how easy you find it). Grading 'easy' bumps ease up; 'again' pushes it down. The next interval = interval * ease, modulated by your grade.",
      },
      {
        heading: "FSRS-lite vs Anki's FSRS",
        text:
          "Anki ships a model fit to your full review history. mneme's in-browser scheduler is a simple SM-2-style version, accurate enough for daily 'what's due' but not as personalized.",
      },
      {
        heading: "Honest grading",
        text:
          "If you grade 'good' on a card you didn't actually recall, you cheat the schedule. Use 'again' freely; that's where memory actually grows.",
      },
    ],
    quiz: {
      question: "What does grading a card 'again' do?",
      choices: [
        "Deletes the card",
        "Resets its interval and queues it again soon",
        "Halves its ease and removes it from the deck",
      ],
      correctIndex: 1,
    },
  },
  {
    id: "retrieval",
    title: "Retrieval > recognition",
    intro:
      "Free recall is harder than picking from a menu, and the harder it is to retrieve, the stronger the memory becomes.",
    body: [
      {
        heading: "The hierarchy",
        text:
          "Recognition (Quiz) < cued recall (Cloze) < free recall (Write). Each mode trains a different memory strength.",
      },
      {
        heading: "Desirable difficulty",
        text:
          "Robert Bjork showed that conditions that slow learning in the short term often produce the best long-term outcomes. Don't optimize for feeling smooth.",
      },
      {
        heading: "How to combine modes",
        text:
          "Start a new topic in Quiz to anchor it, then move to Cloze, then Write. Test mode mixes formats so you can self-check before exams.",
      },
    ],
    quiz: {
      question: "Which mneme study mode trains the strongest recall?",
      choices: ["Quiz (multiple choice)", "Cloze (fill in the blank)", "Write (free recall)"],
      correctIndex: 2,
    },
  },
];

export function LearnShell() {
  return (
    <div className="container py-10">
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Learn</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            How to actually study
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Short, interactive lessons on the memory science that drives every
            mode in this app. Each ends with a one-question check.
          </p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {LESSONS.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="grid items-center gap-4 p-6 md:grid-cols-[1fr_auto]">
            <div>
              <Badge variant="outline" className="text-[10px]">
                Putting it together
              </Badge>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Your weekly recipe
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>
                  <Check className="mr-1.5 inline h-4 w-4 text-success" /> Daily quick
                  Flip on what's due. Honest grading.
                </li>
                <li>
                  <Check className="mr-1.5 inline h-4 w-4 text-success" /> Twice a week:
                  Quiz or Cloze for variation.
                </li>
                <li>
                  <Check className="mr-1.5 inline h-4 w-4 text-success" /> Once a week:
                  Write or Tutor on your weakest tag.
                </li>
                <li>
                  <Check className="mr-1.5 inline h-4 w-4 text-success" /> Test mode 3-5
                  days before the exam, again on the day before.
                </li>
              </ul>
            </div>
            <Button asChild>
              <Link href="/today">
                Start now <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const isQuiz = step >= lesson.body.length;
  const reset = () => {
    setStep(0);
    setPicked(null);
  };

  return (
    <Card>
      <CardHeader>
        <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">
          Lesson {LESSONS.findIndex((l) => l.id === lesson.id) + 1}
        </Badge>
        <CardTitle className="font-display">{lesson.title}</CardTitle>
        <CardDescription>{lesson.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          {lesson.body.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
          <span className={`h-1 flex-1 rounded-full ${isQuiz && picked != null ? "bg-success" : "bg-muted"}`} />
        </div>
        <AnimatePresence mode="wait">
          {!isQuiz ? (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-1"
            >
              <p className="text-sm font-semibold">
                {lesson.body[step].heading}
              </p>
              <p className="text-sm text-muted-foreground">
                {lesson.body[step].text}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <p className="text-sm font-semibold">{lesson.quiz.question}</p>
              <div className="space-y-1.5">
                {lesson.quiz.choices.map((c, i) => {
                  const done = picked != null;
                  const isCorrect = i === lesson.quiz.correctIndex;
                  const isPicked = picked === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={done}
                      onClick={() => setPicked(i)}
                      className={`w-full rounded-md border bg-card p-2 text-left text-sm ${
                        done && isCorrect
                          ? "border-success bg-success/10"
                          : done && isPicked && !isCorrect
                          ? "border-destructive bg-destructive/10"
                          : "hover:border-primary/40"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {picked != null && (
                <p className="text-xs text-muted-foreground">
                  {picked === lesson.quiz.correctIndex
                    ? "Correct. That's the principle in one line."
                    : "Not quite. Re-read the lesson and try again."}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={reset} disabled={step === 0 && picked === null}>
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </Button>
          {!isQuiz ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              {step === lesson.body.length - 1 ? "Take the check" : "Next"}{" "}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              done
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
