"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, Copy, Hash, Heart, Lightbulb, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postImport, type ParsedCard } from "@/lib/import";
import { addCustomCard } from "@/lib/custom-cards";
import { toggleCardArchived, toggleCardFavorite, updateCardOverride } from "@/lib/deck-store";
import { useRouter } from "next/navigation";
import type { ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { toast } from "sonner";

interface BulkActionsBarProps {
  deckId: string;
  selectedIds: Set<string>;
  cards: ResolvedCard[];
  onClear: () => void;
}

export function BulkActionsBar({ deckId, selectedIds, cards, onClear }: BulkActionsBarProps) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState("");
  const [showTag, setShowTag] = useState(false);

  if (selectedIds.size === 0) return null;
  const selected = cards.filter((c) => selectedIds.has(c.id));

  const bulkFavorite = () => {
    for (const c of selected) toggleCardFavorite(deckId, c.id);
    toast.success(`Toggled favorite on ${selected.length} cards`);
  };
  const bulkArchive = () => {
    // Archive is destructive (hides cards from study sessions). N>5 deserves
    // a confirm so a stray click doesn't quietly retire a chunk of the deck.
    if (selected.length > 5) {
      const sure = typeof window !== "undefined" && window.confirm(
        `Archive ${selected.length} cards? They won't appear in study sessions until you restore them. (Un-archive any time from the Archived filter.)`,
      );
      if (!sure) return;
    }
    for (const c of selected) toggleCardArchived(deckId, c.id);
    toast.success(`Toggled archive on ${selected.length} cards`);
    onClear();
  };
  const applyTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    for (const c of selected) {
      const next = Array.from(new Set([...c.customTags, t]));
      updateCardOverride(deckId, c.id, { customTags: next });
    }
    toast.success(`Tag #${t} added to ${selected.length} cards`);
    setTagInput("");
    setShowTag(false);
  };
  const cloneCards = () => {
    // Cloning N cards on a typo creates orphans that look like duplicates
    // forever. Confirm anything beyond a handful.
    if (selected.length > 10) {
      const sure = typeof window !== "undefined" && window.confirm(
        `Clone ${selected.length} cards? Each clone gets a "(copy)" suffix and the "cloned" tag.`,
      );
      if (!sure) return;
    }
    for (const c of selected) {
      addCustomCard(deckId, {
        question: `${c.question} (copy)`,
        answer: c.answer,
        tags: [...c.tags, ...c.customTags, "cloned"],
      });
    }
    toast.success(`Cloned ${selected.length} cards`);
  };
  const exportSubDeck = async () => {
    const meta = loadDeckMeta(deckId);
    const parsed: ParsedCard[] = selected.map((c) => ({
      question: c.question,
      answer: c.answer,
      tags: [...c.tags, ...c.customTags],
      difficulty: c.effective_difficulty || undefined,
      source_fact: c.source_fact || undefined,
    }));
    try {
      const job = await postImport(`${meta.alias || "Deck"} - subset`, parsed);
      toast.success(`Created sub-deck with ${selected.length} cards`);
      router.push(`/decks/${job.id}` as any);
    } catch (err: any) {
      toast.error("Could not export", { description: err?.message || String(err) });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        className="sticky bottom-4 z-20 mx-auto max-w-3xl"
      >
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg ring-1 ring-border">
          <Badge variant="outline" className="border-primary text-primary">
            {selectedIds.size} selected
          </Badge>
          <Button size="sm" variant="ghost" onClick={bulkFavorite}>
            <Heart className="h-3.5 w-3.5" /> Favorite
          </Button>
          <Button size="sm" variant="ghost" onClick={bulkArchive}>
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
          <Button size="sm" variant="ghost" onClick={cloneCards}>
            <Copy className="h-3.5 w-3.5" /> Clone
          </Button>
          {showTag ? (
            <span className="flex items-center gap-1">
              <Input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTag();
                  if (e.key === "Escape") setShowTag(false);
                }}
                placeholder="tag"
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" variant="ghost" onClick={applyTag}>
                Apply
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowTag(true)}>
              <Hash className="h-3.5 w-3.5" /> Add tag
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={exportSubDeck}>
            <Plus className="h-3.5 w-3.5" /> New sub-deck
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
