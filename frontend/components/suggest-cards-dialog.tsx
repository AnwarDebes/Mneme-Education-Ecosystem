"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { suggestCards } from "@/lib/api";
import { addCustomCard } from "@/lib/custom-cards";
import { formatElapsed } from "@/lib/utils";
import type { SuggestedCard } from "@/lib/types";
import { toast } from "sonner";

interface SuggestCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  model: string;
}

export function SuggestCardsDialog({ open, onOpenChange, deckId, model }: SuggestCardsDialogProps) {
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCard[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    setSuggestions([]);
    setAccepted(new Set());
    try {
      const resp = await suggestCards(deckId, { count, model });
      setSuggestions(resp.suggestions);
      setElapsed(resp.elapsed_seconds);
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPending(false);
    }
  };

  const accept = (idx: number) => {
    if (accepted.has(idx)) return;
    const s = suggestions[idx];
    addCustomCard(deckId, {
      question: s.question,
      answer: s.answer,
      tags: ["ai-suggested"],
    });
    setAccepted(new Set([...accepted, idx]));
    toast.success("Card added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Find gaps in your deck
          </DialogTitle>
          <DialogDescription>
            Ollama looks at your source facts and the questions you've already
            covered, then proposes new cards that fill the gaps. Accept the ones
            that fit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <Label>How many?</Label>
              <span className="font-mono">{count}</span>
            </div>
            <Slider value={[count]} min={3} max={15} step={1} onValueChange={(v) => setCount(v[0])} />
          </div>
          <Button onClick={run} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {suggestions.length > 0 ? "Regenerate" : "Generate"}
          </Button>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          <AnimatePresence>
            {suggestions.map((s, i) => {
              const isAccepted = accepted.has(i);
              return (
                <motion.div
                  key={`${i}-${s.question}`}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-lg border p-3 text-sm ${
                    isAccepted ? "border-success/40 bg-success/5" : ""
                  }`}
                >
                  <p className="font-medium leading-snug">{s.question}</p>
                  <p className="mt-1 text-muted-foreground">{s.answer}</p>
                  {s.rationale && (
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Fills: {s.rationale}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    {isAccepted ? (
                      <Badge variant="outline" className="border-success/40 text-success">
                        <Check className="h-3 w-3" /> added
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => accept(i)}>
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {!pending && suggestions.length === 0 && !error && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Set how many to generate, then click "Generate".
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {elapsed != null && `Generated in ${formatElapsed(elapsed)} via ${model}`}
          </p>
          <Button onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
