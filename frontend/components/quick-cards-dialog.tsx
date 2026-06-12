"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cardsFromText, health } from "@/lib/api";
import { postImport } from "@/lib/import";
import { toast } from "sonner";
import type { SuggestedCard } from "@/lib/types";

interface QuickCardsDialogProps {
  trigger?: React.ReactNode;
}

export function QuickCardsDialog({ trigger }: QuickCardsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("Quick cards");
  const [maxCards, setMaxCards] = useState(6);
  const [model, setModel] = useState<string | undefined>();
  const [models, setModels] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [cards, setCards] = useState<SuggestedCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    health()
      .then((h) => {
        setModels(h.ollama_models || []);
        if (!model && h.ollama_models?.length) {
          const pref = h.ollama_models.find((m) => /qwen2\.5|llama3|gemma3/i.test(m));
          setModel(pref || h.ollama_models[0]);
        }
      })
      .catch(() => {});
  }, [open, model]);

  const generate = async () => {
    if (text.trim().length < 20) {
      toast.error("Paste a longer passage so the model has something to work with");
      return;
    }
    setPending(true);
    setError(null);
    setCards([]);
    try {
      const resp = await cardsFromText({ text, max_cards: maxCards, model });
      setCards(resp.cards);
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPending(false);
    }
  };

  const saveAsDeck = async () => {
    if (cards.length === 0) return;
    try {
      const job = await postImport(
        name || "Quick cards",
        cards.map((c) => ({ question: c.question, answer: c.answer, tags: ["quick"] })),
      );
      toast.success(`Imported ${job.n_cards} cards as a new deck`);
      router.push(`/decks/${job.id}` as any);
      setOpen(false);
      setText("");
      setCards([]);
    } catch (err: any) {
      toast.error("Could not save", { description: err?.message || String(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Wand2 className="h-4 w-4" /> Quick cards
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Quick cards from text
          </DialogTitle>
          <DialogDescription>
            Paste any paragraph, get instant flashcards. No file upload, no
            pipeline. Saves as a brand-new deck if you keep them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a passage, lecture excerpt, paragraph..."
            className="font-mono text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="qc-name">Deck name (if you save)</Label>
              <Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max cards</Label>
              <div className="flex items-center gap-2 pt-1">
                <Slider value={[maxCards]} min={2} max={20} step={1} onValueChange={(v) => setMaxCards(v[0])} />
                <span className="w-6 text-right font-mono text-sm">{maxCards}</span>
              </div>
            </div>
          </div>
          {models.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Model:</Label>
              <select
                value={model || ""}
                onChange={(e) => setModel(e.target.value)}
                className="h-7 rounded border bg-background px-2 text-xs"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate cards
          </Button>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {cards.length > 0 && (
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            <AnimatePresence>
              {cards.map((c, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border bg-secondary/30 p-3 text-sm"
                >
                  <p className="font-medium">{c.question}</p>
                  <p className="mt-1 text-muted-foreground">{c.answer}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          {cards.length > 0 && (
            <Button onClick={saveAsDeck}>
              <Check className="h-4 w-4" /> Save as new deck
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
