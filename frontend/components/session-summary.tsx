"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCheck, RotateCcw, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fireConfetti } from "@/lib/confetti";
import { formatElapsed } from "@/lib/utils";

interface SessionSummaryProps {
  total: number;
  correct: number;
  again: number;
  elapsedSeconds: number;
  deckId: string;
  onRestart: () => void;
}

export function SessionSummary({
  total,
  correct,
  again,
  elapsedSeconds,
  deckId,
  onRestart,
}: SessionSummaryProps) {
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  useEffect(() => {
    if (accuracy >= 80 && total >= 5) {
      fireConfetti({ particles: 90, durationMs: 2400 });
    }
  }, [accuracy, total]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-success/40 bg-success/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <Trophy className="h-5 w-5" /> Session complete
          </CardTitle>
          <CardDescription>
            You reviewed {total} cards in {formatElapsed(elapsedSeconds)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Correct" value={`${correct}`} />
            <Stat label="Missed" value={`${again}`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" /> Again
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/decks/${deckId}` as any}>
                <CheckCheck className="h-4 w-4" /> Back to deck
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card p-3 shadow-sm">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
