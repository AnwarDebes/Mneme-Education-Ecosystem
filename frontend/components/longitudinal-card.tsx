"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, BarChart3, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStats } from "@/lib/hooks";
import { bucketStats, type Bucket } from "@/lib/longitudinal";
import { cn } from "@/lib/utils";

export function LongitudinalCard() {
  const stats = useStats();
  const [grain, setGrain] = useState<"week" | "month">("week");
  const count = grain === "week" ? 12 : 12;
  const buckets = useMemo(() => bucketStats(stats, grain, count), [stats, grain]);

  if (buckets.every((b) => b.reviewed === 0)) return null;

  const maxR = Math.max(1, ...buckets.map((b) => b.reviewed));
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const trend = first.reviewed > 0 ? (last.reviewed - first.reviewed) / first.reviewed : 0;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">Growth over time</p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={grain} onValueChange={(v) => setGrain(v as "week" | "month")}>
              <TabsList className="h-7">
                <TabsTrigger value="week" className="px-2 text-xs">Week</TabsTrigger>
                <TabsTrigger value="month" className="px-2 text-xs">Month</TabsTrigger>
              </TabsList>
            </Tabs>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                trend >= 0 ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
              )}
            >
              <Activity className="h-3 w-3" /> {trend > 0 ? "+" : ""}
              {Math.round(trend * 100)}%
            </Badge>
          </div>
        </div>
        <div className="flex h-32 items-end gap-1">
          {buckets.map((b, i) => (
            <Stack key={b.key} bucket={b} maxR={maxR} idx={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Reviews" value={buckets.reduce((a, b) => a + b.reviewed, 0)} />
          <Mini label="Minutes" value={buckets.reduce((a, b) => a + b.minutes, 0)} />
          <Mini
            label="Avg accuracy"
            value={
              Math.round(
                (buckets.reduce((a, b) => a + (b.accuracy || 0), 0) /
                  Math.max(1, buckets.filter((b) => b.reviewed > 0).length)) *
                  100,
              ) || 0
            }
            suffix="%"
          />
          <Mini
            label="Active periods"
            value={buckets.filter((b) => b.reviewed > 0).length}
            suffix={`/${buckets.length}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stack({ bucket, maxR, idx }: { bucket: Bucket; maxR: number; idx: number }) {
  const h = bucket.reviewed === 0 ? 4 : Math.max(6, (bucket.reviewed / maxR) * 100);
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex w-full flex-1 items-end" title={`${bucket.label}: ${bucket.reviewed} reviews, ${bucket.minutes} min, ${Math.round(bucket.accuracy * 100)}% acc`}>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: idx * 0.02 }}
          className={cn(
            "w-full rounded-t",
            bucket.accuracy >= 0.8
              ? "bg-gradient-to-t from-success to-success/60"
              : bucket.accuracy >= 0.6
              ? "bg-gradient-to-t from-primary to-primary/60"
              : bucket.reviewed > 0
              ? "bg-gradient-to-t from-warn to-warn/60"
              : "bg-muted",
          )}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
    </div>
  );
}

function Mini({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <p className="font-display text-xl font-semibold leading-none">
        {value}
        {suffix ?? ""}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
