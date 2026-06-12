"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { explainCard } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import type { ResolvedCard } from "@/lib/cards";

interface ExplainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  card: ResolvedCard | null;
  model: string;
  userAttempt?: string;
}

export function ExplainDialog({
  open,
  onOpenChange,
  deckId,
  card,
  model,
  userAttempt,
}: ExplainDialogProps) {
  const [attempt, setAttempt] = useState("");
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAttempt(userAttempt ?? "");
    setExplanation(null);
    setError(null);
  }, [open, userAttempt]);

  if (!card) return null;

  const run = async () => {
    setPending(true);
    setError(null);
    setExplanation(null);
    try {
      const resp = await explainCard(deckId, {
        question: card.question,
        answer: card.answer,
        user_attempt: attempt.trim() || undefined,
        source_fact: card.source_fact || undefined,
        model,
      });
      setExplanation(resp.explanation);
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Explain this card
          </DialogTitle>
          <DialogDescription>
            Local Ollama writes a friendly explanation. Tell it what you tried
            and it'll address your specific mistake.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-secondary/40 p-3 text-sm">
          <p className="font-medium">Q: {card.question}</p>
          <p className="text-muted-foreground">A: {card.answer}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            What did you guess? (optional)
          </p>
          <Textarea
            rows={2}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="My attempt was..."
          />
        </div>

        <Button onClick={run} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {explanation ? "Explain again" : "Explain"}
        </Button>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <AnimatePresence>
          {explanation && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-md border bg-card p-4"
            >
              <Badge variant="outline" className="mb-2 text-[10px]">
                via {model}
              </Badge>
              <div
                className="space-y-2 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(explanation) }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
