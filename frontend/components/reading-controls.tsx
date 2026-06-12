"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Pause, Play, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordReadingMinutes, loadReading } from "@/lib/reading-session";
import { useStorageVersion } from "@/lib/hooks";
import { toast } from "sonner";

interface ReadingControlsProps {
  deckId: string;
}

export function ReadingControls({ deckId }: ReadingControlsProps) {
  const version = useStorageVersion();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reading = loadReading(deckId);

  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  const start = () => {
    setRunning(true);
    setPaused(false);
    setElapsed(0);
  };
  const stop = () => {
    const minutes = Math.round(elapsed / 60);
    if (minutes > 0) {
      recordReadingMinutes(deckId, minutes);
      toast.success(`Logged ${minutes} min of reading`);
    }
    setRunning(false);
    setPaused(false);
    setElapsed(0);
  };

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-xs">
      <BookOpen className="h-3.5 w-3.5 text-primary" />
      <span className="font-mono">
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      {!running ? (
        <Button size="sm" variant="outline" onClick={start}>
          <Play className="h-3 w-3" /> Start reading
        </Button>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-3 w-3" /> Stop & save
          </Button>
        </>
      )}
      {reading.total_minutes > 0 && (
        <Badge variant="outline" className="ml-auto text-[10px]">
          Lifetime: {reading.total_minutes} min
        </Badge>
      )}
    </div>
  );
}
