"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Combine, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { postImport, type ParsedCard } from "@/lib/import";
import type { JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function DeckMergeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("Merged deck");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    listJobs().then((js) => setJobs(js.filter((j) => j.status === "done"))).catch(() => setJobs([]));
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const totalCards = useMemo(
    () => jobs.filter((j) => picked.has(j.id)).reduce((acc, j) => acc + j.n_cards, 0),
    [jobs, picked],
  );

  const submit = async () => {
    if (picked.size < 2) {
      toast.error("Pick at least two decks");
      return;
    }
    setPending(true);
    try {
      const seen = new Set<string>();
      const all: ParsedCard[] = [];
      for (const id of picked) {
        try {
          const d = await jobDetail(id);
          const resolved = resolveDeck(id, d.cards);
          for (const c of resolved) {
            const key = `${c.question.trim().toLowerCase()}|${c.answer.trim().toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            all.push({
              question: c.question,
              answer: c.answer,
              tags: [...c.tags, ...c.customTags],
              difficulty: c.effective_difficulty || undefined,
              source_fact: c.source_fact || undefined,
            });
          }
        } catch {
          /* skip */
        }
      }
      if (all.length === 0) {
        toast.error("Nothing to merge");
        return;
      }
      const job = await postImport(name || "Merged deck", all);
      toast.success(`Merged ${all.length} unique cards into a new deck`);
      router.push(`/decks/${job.id}` as any);
      setOpen(false);
      setPicked(new Set());
    } catch (err: any) {
      toast.error("Merge failed", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Combine className="h-4 w-4" /> Merge decks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Combine className="h-5 w-5 text-primary" /> Merge two or more decks
          </DialogTitle>
          <DialogDescription>
            Combines unique cards (deduped by exact question+answer match) into a
            single new deck. Originals stay intact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="merge-name">New deck name</Label>
          <Input id="merge-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="max-h-[40vh] space-y-1.5 overflow-y-auto rounded-md border p-2">
          {jobs.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Need at least two decks to merge.
            </p>
          ) : (
            jobs.map((j) => {
              const m = loadDeckMeta(j.id);
              const active = picked.has(j.id);
              return (
                <label
                  key={j.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/40",
                    active && "bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(j.id)}
                    className="h-4 w-4 rounded border-primary text-primary"
                  />
                  <span className="flex-1 truncate">{m.alias || j.filename}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {j.n_cards}
                  </Badge>
                </label>
              );
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {picked.size} deck{picked.size === 1 ? "" : "s"} - {totalCards} cards (before dedup)
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={picked.size < 2 || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Merge {picked.size > 0 ? picked.size : ""} into new deck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
