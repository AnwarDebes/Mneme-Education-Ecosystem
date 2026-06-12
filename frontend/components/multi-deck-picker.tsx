"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Loader2, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import type { Card as CardData, JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { StudyMode } from "@/components/study-mode-selector";

const STUDIO_KEY = "study:multi";

interface MultiDeckSelection {
  deckIds: string[];
  cards: (CardData & { __deck: string })[];
}

export function MultiDeckPicker() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<StudyMode>("flip");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || jobs !== null) return;
    listJobs()
      .then((js) => setJobs(js.filter((j) => j.status === "done")))
      .catch(() => setJobs([]));
  }, [open, jobs]);

  const toggle = (id: string) => {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCards = (jobs ?? [])
    .filter((j) => picked.has(j.id))
    .reduce((acc, j) => acc + j.n_cards, 0);

  const start = async () => {
    if (picked.size === 0) return;
    setLoading(true);
    try {
      const cards: (CardData & { __deck: string })[] = [];
      for (const id of picked) {
        try {
          const d = await jobDetail(id);
          const resolved = resolveDeck(id, d.cards).filter((c) => !c.archived);
          for (const c of resolved) cards.push({ ...c, __deck: id });
        } catch {
          /* skip */
        }
      }
      const payload: MultiDeckSelection = { deckIds: Array.from(picked), cards };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STUDIO_KEY, JSON.stringify(payload));
      }
      router.push(`/study?multi=1&mode=${mode}` as any);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-4 w-4" /> Mix decks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Mix multiple decks
          </DialogTitle>
          <DialogDescription>
            Pick any number of decks. Their cards get shuffled into one session.
            Great for cumulative reviews near an exam.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {!jobs ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No decks yet. Generate one first.
            </p>
          ) : (
            <AnimatePresence>
              {jobs.map((j) => {
                const meta = loadDeckMeta(j.id);
                const active = picked.has(j.id);
                return (
                  <motion.label
                    key={j.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-all",
                      active ? "border-primary bg-primary/5" : "hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggle(j.id)}
                        className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium">{meta.alias || j.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {j.n_cards} cards
                        </p>
                      </div>
                    </div>
                    {active && (
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        Selected
                      </Badge>
                    )}
                  </motion.label>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Study mode</p>
            <Select value={mode} onValueChange={(v) => setMode(v as StudyMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flip">Flip Cards</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="cloze">Fill in the Blank</SelectItem>
                <SelectItem value="write">Write</SelectItem>
                <SelectItem value="match">Match</SelectItem>
                <SelectItem value="speed">Speed Round</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="bg-secondary/40">
            <CardContent className="flex items-center gap-3 p-3 text-xs">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold leading-none">{totalCards}</p>
                <p className="text-muted-foreground">cards in mix</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={start} disabled={picked.size === 0 || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start mixed session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function loadMultiSelection(): MultiDeckSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STUDIO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MultiDeckSelection;
  } catch {
    return null;
  }
}

export function clearMultiSelection(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STUDIO_KEY);
}
