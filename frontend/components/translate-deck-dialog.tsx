"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Globe, Languages, Loader2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translateDeck } from "@/lib/api";
import { postImport } from "@/lib/import";
import type { ResolvedCard } from "@/lib/cards";
import { toast } from "sonner";

interface TranslateDeckDialogProps {
  deckId: string;
  deckName: string;
  cards: ResolvedCard[];
  model: string;
}

const LANGS = [
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Swedish",
  "Norwegian",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Russian",
  "Turkish",
  "Polish",
];

export function TranslateDeckDialog({ deckId, deckName, cards, model }: TranslateDeckDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("Spanish");
  const [customLang, setCustomLang] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const run = async () => {
    const target = (customLang.trim() || lang).trim();
    if (!target) {
      toast.error("Pick a language");
      return;
    }
    setPending(true);
    setProgress(`Translating ${cards.length} cards into ${target}...`);
    try {
      const resp = await translateDeck(deckId, {
        target_language: target,
        model,
      });
      const job = await postImport(`${deckName} (${target})`, resp.cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        tags: ["translated", target.toLowerCase()],
      })));
      toast.success(`Translated to ${target}: ${resp.cards.length} cards`);
      router.push(`/decks/${job.id}` as any);
      setOpen(false);
    } catch (err: any) {
      toast.error("Translation failed", { description: err?.message || String(err) });
    } finally {
      setPending(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Languages className="h-4 w-4" /> Translate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Translate this deck
          </DialogTitle>
          <DialogDescription>
            Local Ollama translates every card and saves the output as a brand
            new deck. The original deck stays untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Target language</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-lang">Or type your own</Label>
            <Input
              id="custom-lang"
              value={customLang}
              onChange={(e) => setCustomLang(e.target.value)}
              placeholder="(e.g. Latin, Esperanto, Welsh)"
            />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {cards.length} cards - via {model}
          </Badge>
          <AnimatePresence>
            {progress && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-md border bg-secondary/40 px-3 py-2 text-xs"
              >
                {progress} (this takes about 5-15 seconds per 6 cards)
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={run} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Translate &amp; save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
