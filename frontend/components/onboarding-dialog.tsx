"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  FileText,
  Flame,
  LayoutDashboard,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readJSON, writeJSON } from "@/lib/storage";

const KEY = "ui:onboarded:v1";

const SLIDES = [
  {
    icon: Sparkles,
    title: "Welcome to mneme",
    body: "A full study ecosystem that lives entirely on your machine. Generate flashcards from any source, then study them five different ways.",
  },
  {
    icon: FileText,
    title: "Step 1: Drop a source",
    body: "PDF, EPUB, Markdown, HTML, plain text - up to 25 MB. mneme extracts atomic facts and turns each one into a card grounded in your source.",
  },
  {
    icon: Brain,
    title: "Step 2: Pick a study mode",
    body: "Flip cards, multiple-choice quiz, fill-in-the-blank, 5-second speed round, or cram mode that auto-queues your misses.",
  },
  {
    icon: LayoutDashboard,
    title: "Step 3: Track your progress",
    body: "Daily streak, 90-day heatmap, per-deck mastery, 12 achievements. Edit cards, favorite them, tag and search across decks.",
  },
  {
    icon: Trophy,
    title: "Ready when you are",
    body: "Generate your first deck or open the library. Everything lives in your browser - no account, no cloud, no per-card fees.",
  },
];

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = readJSON<boolean>(KEY, false);
    if (!seen) setOpen(true);
  }, []);

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const close = () => {
    writeJSON(KEY, true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <motion.div
            key={step}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary"
          >
            <slide.icon className="h-6 w-6" />
          </motion.div>
          <DialogTitle>{slide.title}</DialogTitle>
          <DialogDescription className="text-pretty">{slide.body}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex items-center justify-center gap-1">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={close}>
                Let's go <Flame className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
