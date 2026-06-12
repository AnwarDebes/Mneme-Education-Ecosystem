"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadDeckSchedule } from "@/lib/schedule";
import type { JobSummary } from "@/lib/types";

interface ForgettingCurveProps {
  jobs: JobSummary[];
}

// Bucket reviews by interval-since-last and compute retention rate
// (good + easy / total) per bucket. This is a coarse proxy for the
// classical Ebbinghaus / FSRS retention curve.
const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "Same day", min: 0, max: 0.99 },
  { label: "1 day", min: 1, max: 1.99 },
  { label: "2-3 days", min: 2, max: 3.99 },
  { label: "4-7 days", min: 4, max: 7.99 },
  { label: "1-2 weeks", min: 8, max: 14.99 },
  { label: "2-4 weeks", min: 15, max: 30.99 },
  { label: "1m+", min: 31, max: 9999 },
];

export function ForgettingCurve({ jobs }: ForgettingCurveProps) {
  const points = useMemo(() => {
    const tallies = BUCKETS.map((b) => ({ ...b, good: 0, again: 0, total: 0 }));
    for (const job of jobs) {
      const sched = loadDeckSchedule(job.id);
      for (const cardId of Object.keys(sched)) {
        const s = sched[cardId];
        let last: { ts: number; interval: number } | null = null;
        for (const h of s.history) {
          const ts = new Date(h.graded_at).getTime();
          if (last) {
            const daysSinceLast = (ts - last.ts) / 86400000;
            const bucket = tallies.find((b) => daysSinceLast >= b.min && daysSinceLast <= b.max);
            if (bucket) {
              bucket.total += 1;
              if (h.grade === "good" || h.grade === "easy") bucket.good += 1;
              else bucket.again += 1;
            }
          }
          last = { ts, interval: h.interval_days };
        }
      }
    }
    return tallies;
  }, [jobs]);

  const total = points.reduce((acc, p) => acc + p.total, 0);
  const maxVal = Math.max(1, ...points.map((p) => p.total));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">
              Your forgetting curve
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{total} reviews binned</p>
        </div>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Once you grade a card more than once, we'll bin those reviews by
            time-since-last-review and plot your retention curve.
          </p>
        ) : (
          <>
            <div className="relative h-40">
              <svg viewBox="0 0 700 160" className="h-full w-full">
                <line x1="40" y1="140" x2="690" y2="140" stroke="hsl(var(--border))" strokeWidth="1" />
                {[0, 0.25, 0.5, 0.75, 1].map((y) => (
                  <g key={y}>
                    <line
                      x1="40"
                      y1={140 - y * 120}
                      x2="690"
                      y2={140 - y * 120}
                      stroke="hsl(var(--border) / 0.4)"
                      strokeWidth="0.5"
                      strokeDasharray="2 3"
                    />
                    <text
                      x="34"
                      y={144 - y * 120}
                      textAnchor="end"
                      fontSize="9"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {Math.round(y * 100)}%
                    </text>
                  </g>
                ))}
                {points.map((p, i) => {
                  if (p.total === 0) return null;
                  const x = 40 + (i / Math.max(1, points.length - 1)) * 640;
                  const rate = p.good / p.total;
                  const y = 140 - rate * 120;
                  const size = 4 + (p.total / maxVal) * 8;
                  return (
                    <g key={i}>
                      <motion.line
                        x1={40 + ((Math.max(0, i - 1)) / Math.max(1, points.length - 1)) * 640}
                        y1={140 - (i > 0 ? (points[i - 1].good / Math.max(1, points[i - 1].total)) * 120 : rate * 120)}
                        x2={x}
                        y2={y}
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                      />
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={size}
                        fill="hsl(var(--primary))"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.05 + 0.2 }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
              {points.map((p, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="font-medium">{p.label}</p>
                  <p>
                    {p.total > 0 ? `${Math.round((p.good / p.total) * 100)}%` : "-"}
                  </p>
                  <p className="opacity-60">{p.total} reviews</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Retention rate at each interval. Dot size reflects sample volume.
              The natural curve dips as time grows; spaced repetition is what flattens it.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
