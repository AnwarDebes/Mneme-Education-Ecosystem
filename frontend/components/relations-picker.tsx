"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Link2, Network, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addRelation,
  loadRelations,
  removeRelation,
  type RelationKind,
} from "@/lib/relationships";
import { useStorageVersion } from "@/lib/hooks";
import type { ResolvedCard } from "@/lib/cards";
import { cn, truncate } from "@/lib/utils";
import { toast } from "sonner";

interface RelationsPickerProps {
  deckId: string;
  card: ResolvedCard;
  allCards: ResolvedCard[];
}

export function RelationsPicker({ deckId, card, allCards }: RelationsPickerProps) {
  const version = useStorageVersion();
  const [tab, setTab] = useState<"prereq" | "related">("related");
  const [search, setSearch] = useState("");

  const relations = useMemo(() => loadRelations(deckId), [deckId, version]);
  const linksOut = useMemo(
    () => relations.filter((r) => r.from === card.id && r.kind === tab),
    [relations, card.id, tab],
  );
  const linksIn = useMemo(
    () =>
      tab === "prereq"
        ? relations.filter((r) => r.to === card.id && r.kind === "prereq")
        : [],
    [relations, card.id, tab],
  );
  const linkedIds = new Set([...linksOut.map((r) => r.to), ...linksIn.map((r) => r.from)]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allCards
      .filter((c) => c.id !== card.id)
      .filter((c) =>
        !q
          ? !linkedIds.has(c.id)
          : c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q),
      )
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, card.id, linkedIds, search]);

  const toggleLink = (otherId: string) => {
    const exists = relations.some(
      (r) => r.from === card.id && r.to === otherId && r.kind === tab,
    );
    if (exists) {
      removeRelation(deckId, card.id, otherId, tab as RelationKind);
      toast.success("Link removed");
    } else {
      addRelation(deckId, card.id, otherId, tab as RelationKind);
      toast.success(tab === "prereq" ? "Marked as prerequisite" : "Linked as related");
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Card relationships</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "prereq" | "related")}>
          <TabsList className="h-8">
            <TabsTrigger value="related" className="text-xs">Related</TabsTrigger>
            <TabsTrigger value="prereq" className="text-xs">Prerequisite</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {(linksOut.length > 0 || linksIn.length > 0) && (
        <div className="space-y-1.5">
          <AnimatePresence>
            {[...linksIn, ...linksOut].map((r) => {
              const otherId = r.from === card.id ? r.to : r.from;
              const other = allCards.find((c) => c.id === otherId);
              if (!other) return null;
              const incoming = r.to === card.id;
              return (
                <motion.div
                  key={`${r.from}-${r.to}-${r.kind}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-md border bg-card p-2 text-xs"
                >
                  <Badge variant="outline" className="text-[10px]">
                    {r.kind === "prereq" ? (incoming ? "needs this" : "needs first") : "related"}
                  </Badge>
                  {incoming && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  <p className="flex-1 truncate">{truncate(other.question, 90)}</p>
                  {!incoming && r.kind === "prereq" && (
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      removeRelation(deckId, r.from, r.to, r.kind as RelationKind)
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Find a card to link as ${tab === "prereq" ? "prerequisite" : "related"}`}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Type to search other cards.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleLink(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left text-xs hover:border-primary/50",
                  linkedIds.has(c.id) && "border-primary/40 bg-primary/5",
                )}
              >
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <p className="flex-1 truncate">{truncate(c.question, 80)}</p>
                <span className="text-[10px] text-muted-foreground">
                  {linkedIds.has(c.id) ? "unlink" : "link"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface RelatedCardsStripProps {
  deckId: string;
  card: ResolvedCard;
  allCards: ResolvedCard[];
  onPick?: (card: ResolvedCard) => void;
}

export function RelatedCardsStrip({
  deckId,
  card,
  allCards,
  onPick,
}: RelatedCardsStripProps) {
  const version = useStorageVersion();
  const relations = useMemo(() => loadRelations(deckId), [deckId, version]);
  const linked = useMemo(() => {
    const out: { card: ResolvedCard; kind: RelationKind; incoming: boolean }[] = [];
    for (const r of relations) {
      if (r.from !== card.id && r.to !== card.id) continue;
      const otherId = r.from === card.id ? r.to : r.from;
      const other = allCards.find((c) => c.id === otherId);
      if (!other) continue;
      out.push({ card: other, kind: r.kind, incoming: r.to === card.id });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relations, card.id, allCards.length]);

  if (linked.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Network className="h-3 w-3" /> Related cards
      </p>
      <div className="flex flex-wrap gap-1.5">
        {linked.map(({ card: c, kind, incoming }, i) => (
          <button
            key={`${c.id}-${i}`}
            type="button"
            onClick={() => onPick?.(c)}
            className={cn(
              "max-w-[28ch] truncate rounded-full border bg-card px-2.5 py-0.5 text-xs hover:border-primary/40",
              kind === "prereq" && "border-amber-400/40 text-amber-700 dark:text-amber-300",
            )}
            title={c.question}
          >
            {kind === "prereq" ? (incoming ? "needs " : "first ") : ""}#{truncate(c.question, 30)}
          </button>
        ))}
      </div>
    </div>
  );
}
