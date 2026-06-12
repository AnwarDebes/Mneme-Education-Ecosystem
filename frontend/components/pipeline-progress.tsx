"use client";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { JobStatus, StageEvent } from "@/lib/types";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/types";

interface PipelineProgressProps {
  status: JobStatus;
  events: StageEvent[];
  error?: string | null;
}

export function PipelineProgress({ status, events, error }: PipelineProgressProps) {
  const completed = new Set<JobStatus>();
  for (const evt of events) {
    if (evt.outputs > 0 || evt.message.endsWith("done")) {
      completed.add(evt.stage);
    }
  }
  const currentIndex = STAGE_ORDER.indexOf(status);

  return (
    <div className="space-y-3">
      {STAGE_ORDER.map((stage, i) => {
        const stageEvents = events.filter((e) => e.stage === stage);
        const isCompleted = completed.has(stage) || i < currentIndex;
        const isActive = stage === status && status !== "done" && status !== "error";
        const isError = status === "error" && i === currentIndex;
        const lastEvent = stageEvents[stageEvents.length - 1];

        return (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              "flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors",
              isActive && "border-primary shadow-sm",
              isError && "border-destructive",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                isCompleted && !isError && "bg-success/15 text-success",
                isActive && "bg-primary/15 text-primary",
                isError && "bg-destructive/15 text-destructive",
                !isCompleted && !isActive && !isError && "bg-muted text-muted-foreground",
              )}
            >
              {isError ? (
                <CircleAlert className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs font-medium">{i + 1}</span>
              )}
            </span>
            <div className="flex-1">
              <p className="font-medium">{STAGE_LABELS[stage]}</p>
              {lastEvent && (
                <p className="text-xs text-muted-foreground">
                  {lastEvent.inputs > 0 && (
                    <>{lastEvent.inputs} in -&gt; </>
                  )}
                  {lastEvent.outputs > 0 && (
                    <>{lastEvent.outputs} out </>
                  )}
                  {lastEvent.elapsed_seconds > 0 && (
                    <>({lastEvent.elapsed_seconds.toFixed(1)}s)</>
                  )}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Pipeline error</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}
