"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Lightbulb, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { autoHint, getCardHints, setCardHints } from "@/lib/hints";
import { useStorageVersion } from "@/lib/hooks";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface HintStripProps {
  deckId: string;
  card: ResolvedCard;
  className?: string;
}

export function HintStrip({ deckId, card, className }: HintStripProps) {
  const version = useStorageVersion();
  const hints = useMemo(() => getCardHints(deckId, card.id), [deckId, card.id, version]);
  const auto = useMemo(() => autoHint(card.answer), [card.answer]);
  const [revealed, setRevealed] = useState(0);
  const [showAuto, setShowAuto] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  // Reset when card changes
  useEffect(() => {
    setRevealed(0);
    setShowAuto(false);
    setEditing(false);
  }, [card.id]);

  if (editing) {
    return (
      <HintEditor
        deckId={deckId}
        card={card}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setEditing(false)}
      />
    );
  }

  const startEdit = () => {
    setDraft(hints.length ? hints.slice() : [""]);
    setEditing(true);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Hints</p>
        {hints.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {revealed} / {hints.length} shown
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {hints.length > 0 && revealed < hints.length && (
            <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => r + 1)}>
              <Eye className="h-3.5 w-3.5" /> Reveal next
            </Button>
          )}
          {hints.length === 0 && auto && (
            <Button size="sm" variant="ghost" onClick={() => setShowAuto((s) => !s)}>
              <Eye className="h-3.5 w-3.5" /> {showAuto ? "Hide" : "Auto hint"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={startEdit}>
            {hints.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {hints.length === 0 ? "Add" : "Edit"}
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {hints.slice(0, revealed).map((h, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-md border border-amber-300/40 bg-amber-100/40 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              Hint {i + 1}
            </span>
            <p className="mt-0.5">{h}</p>
          </motion.div>
        ))}
        {showAuto && hints.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-md border border-amber-300/40 bg-amber-100/40 px-3 py-2 font-mono text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {auto}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HintEditor({
  deckId,
  card,
  draft,
  setDraft,
  onClose,
}: {
  deckId: string;
  card: ResolvedCard;
  draft: string[];
  setDraft: (d: string[]) => void;
  onClose: () => void;
}) {
  const save = () => {
    const clean = draft.map((h) => h.trim()).filter(Boolean);
    setCardHints(deckId, card.id, clean);
    toast.success(clean.length ? "Hints saved" : "Hints removed");
    onClose();
  };
  return (
    <div className="space-y-2 rounded-md border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Edit hints
        </p>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5">
        {draft.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={h}
              onChange={(e) => {
                const next = draft.slice();
                next[i] = e.target.value;
                setDraft(next);
              }}
              placeholder={`Hint ${i + 1}`}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
              title="Remove this hint"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraft([...draft, ""])}
        >
          <Plus className="h-3.5 w-3.5" /> Add hint
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  );
}
