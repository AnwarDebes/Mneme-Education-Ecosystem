"use client";
import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Target, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ResolvedCard } from "@/lib/cards";
import { deckReadiness } from "@/lib/exam-readiness";
import { useStorageVersion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface ExamReadinessCardProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function ExamReadinessCard({ deckId, cards }: ExamReadinessCardProps) {
  const version = useStorageVersion();
  const report = useMemo(() => deckReadiness(deckId, cards), [deckId, cards, version]);

  if (cards.length === 0) return null;

  const bandStyles = {
    "not-ready": { label: "Not ready", tone: "border-destructive/40 bg-destructive/5 text-destructive" },
    shaky: { label: "Shaky", tone: "border-warn/40 bg-warn/5 text-warn" },
    good: { label: "Good", tone: "border-primary/40 bg-primary/5 text-primary" },
    "exam-ready": { label: "Exam-ready", tone: "border-success/40 bg-success/5 text-success" },
  } as const;

  const band = bandStyles[report.band];

  return (
    <Card className={cn("border", band.tone)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <p className="font-display text-lg font-semibold">Pre-flight check</p>
            <Badge variant="outline" className={band.tone}>
              {band.label}
            </Badge>
          </div>
          <div className="font-mono text-2xl font-semibold">{report.score}/100</div>
        </div>
        <Progress value={report.score} className="h-2" />

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Mini label="Mastered" value={`${report.mastered_pct}%`} />
          <Mini label="Unseen" value={`${report.unseen}`} tone={report.unseen ? "warn" : "ok"} />
          <Mini label="Due now" value={`${report.due_now}`} tone={report.due_now ? "primary" : "ok"} />
          <Mini label="Weak tags" value={`${report.weak_tags.length}`} tone={report.weak_tags.length ? "warn" : "ok"} />
        </div>

        {report.reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {report.reasons.slice(0, 4).map((r, i) => (
              <li key={i}>- {r}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <p>{report.next_step}</p>
          </div>
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant="outline">
              <Link href={`/study?job=${deckId}&mode=cram` as any}>Cram</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/study?job=${deckId}&mode=test` as any}>
                Test <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" | "primary" }) {
  const cls =
    tone === "warn"
      ? "border-destructive/40"
      : tone === "primary"
      ? "border-primary/40"
      : "";
  return (
    <div className={cn("rounded-md border bg-card p-2 text-center", cls)}>
      <p className="font-display text-lg font-semibold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
