"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  FileQuestion,
  GraduationCap,
  Headphones,
  ListChecks,
  Mic,
  PencilLine,
  Repeat,
  Shuffle,
  Timer,
  Trophy,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type StudyMode =
  | "flip"
  | "quiz"
  | "cloze"
  | "speed"
  | "cram"
  | "match"
  | "write"
  | "test"
  | "tutor"
  | "listen"
  | "voice-only";

export const STUDY_MODES: Array<{
  id: StudyMode;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    id: "flip",
    name: "Flip Cards",
    description: "Classic spaced repetition. Tap to flip, grade your recall.",
    icon: Repeat,
    accent: "from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-300",
  },
  {
    id: "quiz",
    name: "Quiz",
    description: "Multiple choice. Pick the right answer from four options.",
    icon: ListChecks,
    accent: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-300",
  },
  {
    id: "cloze",
    name: "Fill in the Blank",
    description: "Type the answer. We blank out a key term in context.",
    icon: FileQuestion,
    accent: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-300",
  },
  {
    id: "write",
    name: "Write",
    description: "Type the full answer in your own words; we score key terms.",
    icon: PencilLine,
    accent: "from-sky-500/20 to-blue-500/20 text-sky-600 dark:text-sky-300",
  },
  {
    id: "match",
    name: "Match",
    description: "Pair questions with their answers in rounds of six.",
    icon: Shuffle,
    accent: "from-teal-500/20 to-cyan-500/20 text-teal-600 dark:text-teal-300",
  },
  {
    id: "speed",
    name: "Speed Round",
    description: "5-second answers. Sharpen instant recall.",
    icon: Timer,
    accent: "from-rose-500/20 to-pink-500/20 text-rose-600 dark:text-rose-300",
  },
  {
    id: "cram",
    name: "Cram",
    description: "Only the cards you got wrong, plus due reviews. Crush them.",
    icon: Brain,
    accent: "from-fuchsia-500/20 to-purple-500/20 text-fuchsia-600 dark:text-fuchsia-300",
  },
  {
    id: "test",
    name: "Test",
    description: "Timed mixed-format exam. Scored at the end with full breakdown.",
    icon: Trophy,
    accent: "from-yellow-500/20 to-orange-500/20 text-yellow-600 dark:text-yellow-300",
  },
  {
    id: "tutor",
    name: "AI Tutor",
    description: "Socratic coaching. The local LLM walks you through each card.",
    icon: GraduationCap,
    accent: "from-cyan-500/20 to-sky-500/20 text-cyan-600 dark:text-cyan-300",
  },
  {
    id: "listen",
    name: "Listen-only",
    description: "Hands-free. We speak the question, you speak the answer.",
    icon: Headphones,
    accent: "from-lime-500/20 to-emerald-500/20 text-lime-600 dark:text-lime-300",
  },
  {
    id: "voice-only",
    name: "Voice-only",
    description: "Fully hands-free. We auto-grade your spoken answer.",
    icon: Mic,
    accent: "from-pink-500/20 to-rose-500/20 text-pink-600 dark:text-pink-300",
  },
];

interface StudyModeSelectorProps {
  deckId: string;
  dueCount?: number;
  totalCount?: number;
}

export function StudyModeSelector({ deckId, dueCount, totalCount }: StudyModeSelectorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      {STUDY_MODES.map((m, i) => {
        const Icon = m.icon;
        const subtitle =
          m.id === "cram" && dueCount != null
            ? `${dueCount} due`
            : m.id === "flip" && totalCount != null
            ? `${totalCount} cards`
            : m.description;
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              href={`/study?job=${deckId}&mode=${m.id}` as any}
              className={cn(
                "group flex items-start gap-3 rounded-lg border bg-gradient-to-br p-3 transition-all hover:border-primary/40 hover:shadow-sm",
                m.accent,
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card shadow-sm ring-1 ring-border">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium leading-tight text-foreground">{m.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {m.id === "cram" || m.id === "flip" ? subtitle : m.description}
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
