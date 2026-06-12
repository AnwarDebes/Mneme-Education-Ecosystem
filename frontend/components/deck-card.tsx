"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArchiveRestore,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  MoreVertical,
  PencilLine,
  Star,
  Trash2,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loadDeckMeta, saveDeckMeta, emptyMeta, toggleDeckArchived, toggleDeckStar } from "@/lib/deck-store";
import { deckScheduleStats } from "@/lib/schedule";
import { deleteJob } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { JobSummary } from "@/lib/types";
import { toast } from "sonner";

const DECK_COLORS = [
  "from-violet-500/30 to-indigo-400/30",
  "from-amber-400/30 to-rose-400/30",
  "from-emerald-400/30 to-teal-400/30",
  "from-sky-400/30 to-cyan-400/30",
  "from-fuchsia-400/30 to-pink-400/30",
  "from-orange-400/30 to-red-400/30",
];

function deckColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xfffffff;
  return DECK_COLORS[hash % DECK_COLORS.length];
}

interface DeckCardProps {
  deck: JobSummary;
  cardIds: string[];
  onChange?: () => void;
}

function DeckCardImpl({ deck, cardIds, onChange }: DeckCardProps) {
  const meta = useMemo(() => loadDeckMeta(deck.id), [deck.id]);
  const schedStats = useMemo(() => deckScheduleStats(deck.id, cardIds), [deck.id, cardIds]);
  const [open, setOpen] = useState(false);
  const title = meta.alias || deck.filename;
  const progress = deck.n_cards ? Math.round((schedStats.learned / deck.n_cards) * 100) : 0;
  const color = meta.color || deckColor(deck.id);

  const onStar = (e: React.MouseEvent) => {
    e.preventDefault();
    const starred = toggleDeckStar(deck.id);
    toast.success(starred ? "Starred" : "Unstarred");
    onChange?.();
  };

  const onArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    const archived = toggleDeckArchived(deck.id);
    toast.success(archived ? "Archived" : "Restored");
    onChange?.();
  };

  const onDelete = async () => {
    // Two-step destructive confirm. Anything irreversible should not be
    // a single click - bulk-actions confirmation follows the same rule.
    const sure = typeof window !== "undefined" && window.confirm(
      `Permanently delete "${title}"?\n\nThis removes the deck from the server and clears your local edits, stats, and FSRS state for it. Your other decks are unaffected.`,
    );
    if (!sure) return;
    try {
      await deleteJob(deck.id);
      // Strip local browser-side state for this deck so it doesn't ghost.
      saveDeckMeta(deck.id, emptyMeta());
      if (typeof window !== "undefined") {
        for (const prefix of ["fsrs:", "variants:", "card-ratings:", "lecture-audio:", "snapshots:", "chains:", "notes:"]) {
          window.localStorage.removeItem(prefix + deck.id);
        }
      }
      toast.success("Deck deleted");
      onChange?.();
    } catch (err: any) {
      const { toastActionFailed } = await import("@/lib/toast-helpers");
      toastActionFailed("delete deck", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group relative overflow-hidden">
        <div
          className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-60", color)}
          aria-hidden
        />
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStar}>
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      meta.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{meta.starred ? "Unstar" : "Star deck"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem asChild>
                <Link href={`/decks/${deck.id}` as any}>
                  <PencilLine className="h-3.5 w-3.5" /> Open & edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/study?job=${deck.id}` as any}>
                  <BookOpen className="h-3.5 w-3.5" /> Study now
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onArchive(new MouseEvent("click") as any)}>
                {meta.archived ? (
                  <>
                    <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" /> Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link href={`/decks/${deck.id}` as any} className="block">
          <CardContent className="relative z-[1] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card shadow-sm ring-1 ring-border">
                <Brain className="h-6 w-6 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-lg font-semibold leading-tight">
                  {title}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(deck.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini value={deck.n_cards} label="cards" />
              <Mini value={schedStats.due_now} label="due now" tone={schedStats.due_now ? "primary" : "muted"} />
              <Mini value={schedStats.mastered} label="mastered" tone="success" />
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Learning progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {deck.status === "done" ? (
                  <Badge variant="outline" className="text-xs">
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs capitalize">
                    {deck.status.replace(/_/g, " ")}
                  </Badge>
                )}
                {meta.starred && (
                  <Badge variant="outline" className="border-amber-300/60 text-amber-600 dark:text-amber-300">
                    Starred
                  </Badge>
                )}
                {meta.archived && (
                  <Badge variant="outline" className="border-muted">
                    Archived
                  </Badge>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                Open <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
}

function Mini({ value, label, tone = "muted" }: { value: number; label: string; tone?: "muted" | "primary" | "success" }) {
  const toneClasses = {
    muted: "bg-secondary/60 text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
  } as const;
  return (
    <div className={cn("rounded-md px-2 py-1.5", toneClasses[tone])}>
      <p className="font-display text-lg font-semibold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

// Skip re-render when the deck identity + card-id list are unchanged.
// Storage-version bumps go through useStorageVersion in the parent, so meta
// changes still propagate via the deck.id key.
export const DeckCard = memo(DeckCardImpl, (prev, next) => {
  if (prev.deck.id !== next.deck.id) return false;
  if (prev.deck.n_cards !== next.deck.n_cards) return false;
  if (prev.deck.status !== next.deck.status) return false;
  if (prev.onChange !== next.onChange) return false;
  if (prev.cardIds.length !== next.cardIds.length) return false;
  for (let i = 0; i < prev.cardIds.length; i++) {
    if (prev.cardIds[i] !== next.cardIds[i]) return false;
  }
  return true;
});
