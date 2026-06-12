"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Shuffle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addVariant,
  getVariants,
  removeVariant,
} from "@/lib/card-variants";
import { useStorageVersion } from "@/lib/hooks";
import { toast } from "sonner";

interface VariantsSectionProps {
  deckId: string;
  cardId: string;
  originalQuestion: string;
}

export function VariantsSection({ deckId, cardId, originalQuestion }: VariantsSectionProps) {
  const version = useStorageVersion();
  const [variants, setVariants] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setVariants(getVariants(deckId, cardId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, cardId, version]);

  const submit = () => {
    if (!draft.trim()) return;
    if (draft.trim().toLowerCase() === originalQuestion.trim().toLowerCase()) {
      toast.error("That's the original question");
      return;
    }
    addVariant(deckId, cardId, draft.trim());
    setDraft("");
    toast.success("Variant added");
  };

  return (
    <div className="space-y-2 rounded-md border bg-secondary/30 p-3">
      <div className="flex items-center gap-2">
        <Shuffle className="h-3.5 w-3.5 text-primary" />
        <p className="text-sm font-semibold">Question variants</p>
        <Badge variant="outline" className="text-[10px]">
          {variants.length + 1} phrasings
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Add alternative phrasings for the same answer. Future study sessions
        randomize between them to train recognition + paraphrase + application.
      </p>
      <div className="rounded-md border bg-card px-2 py-1 text-xs">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Original
        </span>
        <p>{originalQuestion}</p>
      </div>
      <AnimatePresence>
        {variants.map((v) => (
          <motion.div
            key={v}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs"
          >
            <span className="flex-1">{v}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => removeVariant(deckId, cardId, v)}
            >
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Another way to ask this..."
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="text-sm"
        />
        <Button size="sm" onClick={submit} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
