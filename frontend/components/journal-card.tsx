"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Check, Edit3, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listJournalDates,
  loadJournalEntry,
  MOOD_EMOJI,
  saveJournalEntry,
  type JournalEntry,
  type Mood,
} from "@/lib/journal";
import { useStorageVersion } from "@/lib/hooks";
import { isoDate } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function JournalCard() {
  const version = useStorageVersion();
  const today = isoDate();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [mood, setMood] = useState<Mood>("good");
  const [reflection, setReflection] = useState("");
  const [takeaway, setTakeaway] = useState("");
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const cur = loadJournalEntry(today);
    setEntry(cur);
    if (cur) {
      setMood(cur.mood);
      setReflection(cur.reflection);
      setTakeaway(cur.takeaway);
    }
    const dates = listJournalDates(30);
    setHistory(dates.map((d) => loadJournalEntry(d)!).filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const save = () => {
    const next = saveJournalEntry({ date: today, mood, reflection, takeaway });
    setEntry(next);
    toast.success(entry ? "Journal updated" : "Journal entry saved");
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Book className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Study journal</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              One quick reflection a day; it compounds.
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            <History className="h-3.5 w-3.5" /> {history.length} entries
          </Button>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            How did today's session feel?
          </Label>
          <div className="flex flex-wrap gap-2">
            {(["great", "good", "okay", "tired", "off"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm transition-all",
                  mood === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="text-lg">{MOOD_EMOJI[m]}</span>
                <span className="capitalize">{m}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="reflection">Reflection (free-form)</Label>
          <Textarea
            id="reflection"
            rows={3}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What worked? What didn't? What surprised you?"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="takeaway">One-line takeaway</Label>
          <Textarea
            id="takeaway"
            rows={2}
            value={takeaway}
            onChange={(e) => setTakeaway(e.target.value)}
            placeholder="The single thing you want future-you to remember."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={save}>
            {entry ? <Edit3 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {entry ? "Update" : "Save"}
          </Button>
        </div>
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 border-t pt-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Recent entries
              </p>
              {history.map((h) => (
                <div key={h.date} className="rounded-md border bg-secondary/30 p-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{new Date(h.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {MOOD_EMOJI[h.mood]} {h.mood}
                    </Badge>
                  </div>
                  {h.takeaway && <p className="mt-1 italic text-muted-foreground">"{h.takeaway}"</p>}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
