"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scissors, Sparkles } from "lucide-react";
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
import { postImport } from "@/lib/import";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeckSplitDialogProps {
  deckId: string;
  deckName: string;
  cards: ResolvedCard[];
}

// Group cards by their most-frequent tag. Cards without tags go to "untagged".
function clusterByTag(cards: ResolvedCard[]): Record<string, ResolvedCard[]> {
  const out: Record<string, ResolvedCard[]> = {};
  for (const c of cards) {
    const tag = c.tags[0] || c.customTags[0] || "untagged";
    if (!out[tag]) out[tag] = [];
    out[tag].push(c);
  }
  return out;
}

export function DeckSplitDialog({ deckId, deckName, cards }: DeckSplitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const clusters = useMemo(() => clusterByTag(cards), [cards]);
  const tags = Object.keys(clusters).sort((a, b) => clusters[b].length - clusters[a].length);

  const split = async () => {
    if (picked.size === 0) return;
    setPending(true);
    try {
      for (const tag of picked) {
        const subset = clusters[tag] ?? [];
        if (subset.length === 0) continue;
        await postImport(`${deckName} - ${tag}`, subset.map((c) => ({
          question: c.question,
          answer: c.answer,
          tags: [...c.tags, ...c.customTags],
          difficulty: c.effective_difficulty || undefined,
          source_fact: c.source_fact || undefined,
        })));
      }
      toast.success(`Created ${picked.size} sub-deck${picked.size === 1 ? "" : "s"}`);
      setOpen(false);
      router.push("/library");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scissors className="h-4 w-4" /> Split by topic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" /> Split this deck by topic
          </DialogTitle>
          <DialogDescription>
            Each card lands in the cluster of its most-frequent tag. Pick the
            clusters you want as new decks; the original deck stays intact.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] space-y-1 overflow-y-auto">
          {tags.map((t) => {
            const subset = clusters[t];
            const active = picked.has(t);
            return (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md border p-2 text-sm",
                  active && "border-primary bg-primary/5",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      const next = new Set(picked);
                      if (active) next.delete(t);
                      else next.add(t);
                      setPicked(next);
                    }}
                    className="h-4 w-4"
                  />
                  <span>#{t}</span>
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {subset.length} cards
                </Badge>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={split} disabled={picked.size === 0 || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create {picked.size > 0 ? `${picked.size} sub-deck${picked.size === 1 ? "" : "s"}` : "sub-decks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
