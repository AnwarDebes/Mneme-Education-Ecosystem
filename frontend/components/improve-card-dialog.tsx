"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Frown,
  Loader2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";
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
import { improveCard } from "@/lib/api";
import { updateCardOverride } from "@/lib/deck-store";
import type { ResolvedCard } from "@/lib/cards";
import type { ImproveMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImproveCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  card: ResolvedCard | null;
  model: string;
}

const MODES: Array<{
  id: ImproveMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    id: "clarify",
    label: "Clarify",
    description: "Sharpen the wording without changing the meaning.",
    icon: Wand2,
    accent: "text-primary",
  },
  {
    id: "simplify",
    label: "Simplify",
    description: "Re-write for a beginner; drop jargon.",
    icon: Sparkles,
    accent: "text-emerald-500",
  },
  {
    id: "variation",
    label: "Variation",
    description: "Same fact, different phrasing. Great for interleaving.",
    icon: Shuffle,
    accent: "text-amber-500",
  },
  {
    id: "harder",
    label: "Make harder",
    description: "Push the question toward deeper understanding.",
    icon: Zap,
    accent: "text-rose-500",
  },
];

export function ImproveCardDialog({
  open,
  onOpenChange,
  deckId,
  card,
  model,
}: ImproveCardDialogProps) {
  const [mode, setMode] = useState<ImproveMode>("clarify");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!card) return null;

  const close = () => {
    setDraft(null);
    setError(null);
    onOpenChange(false);
  };

  const run = async () => {
    setPending(true);
    setError(null);
    setDraft(null);
    try {
      const resp = await improveCard(deckId, {
        question: card.question,
        answer: card.answer,
        mode,
        model,
      });
      setDraft({ question: resp.question, answer: resp.answer });
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPending(false);
    }
  };

  const apply = () => {
    if (!draft) return;
    updateCardOverride(deckId, card.id, {
      question: draft.question,
      answer: draft.answer,
    });
    toast.success("Card improved");
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Improve with AI
          </DialogTitle>
          <DialogDescription>
            Use Ollama to rewrite this card. Pick a transformation, preview the result, apply if you like it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                  mode === m.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "hover:border-primary/40",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-card ring-1 ring-border">
                  <Icon className={cn("h-4 w-4", m.accent)} />
                </span>
                <div>
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Original</Badge>
            </div>
            <div className="rounded-md border bg-secondary/40 p-3 text-sm">
              <p className="font-medium">{card.question}</p>
              <div className="my-2 h-px bg-border" />
              <p className="text-muted-foreground">{card.answer}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-primary/40 text-primary">
                AI rewrite
              </Badge>
              {draft && (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-success">
                  <Check className="h-3 w-3" /> ready
                </span>
              )}
            </div>
            <div className={cn(
              "min-h-[110px] rounded-md border p-3 text-sm",
              draft ? "bg-primary/5" : "bg-muted/40",
            )}>
              {pending ? (
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {model} thinking...
                </div>
              ) : draft ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${draft.question}-${draft.answer}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="font-medium">{draft.question}</p>
                    <div className="my-2 h-px bg-border" />
                    <p className="text-muted-foreground">{draft.answer}</p>
                  </motion.div>
                </AnimatePresence>
              ) : error ? (
                <p className="flex items-start gap-2 text-destructive">
                  <Frown className="h-4 w-4 shrink-0" /> {error}
                </p>
              ) : (
                <p className="italic text-muted-foreground">
                  Hit "Generate" to see the rewrite.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={run} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {draft ? "Try again" : "Generate"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={apply} disabled={!draft}>
              <Check className="h-4 w-4" /> Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
