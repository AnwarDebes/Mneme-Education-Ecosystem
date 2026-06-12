"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, GitBranch, Link2, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStorageVersion } from "@/lib/hooks";
import { deleteChain, loadChains, saveChain, type CardChain } from "@/lib/card-chains";
import type { ResolvedCard } from "@/lib/cards";
import { truncate } from "@/lib/utils";
import { toast } from "sonner";

interface ChainsPanelProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function ChainsPanel({ deckId, cards }: ChainsPanelProps) {
  const version = useStorageVersion();
  const chains = useMemo(() => loadChains(deckId), [deckId, version]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [building, setBuilding] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  if (cards.length === 0) return null;

  const candidates = search.trim()
    ? cards.filter(
        (c) =>
          c.question.toLowerCase().includes(search.toLowerCase()) ||
          c.answer.toLowerCase().includes(search.toLowerCase()),
      ).slice(0, 6)
    : [];

  const finish = () => {
    if (!building || building.length < 2) {
      toast.error("A chain needs at least 2 cards");
      return;
    }
    saveChain(deckId, name, building);
    toast.success(`Chain "${name || "Chain"}" saved`);
    setBuilding(null);
    setName("");
    setSearch("");
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/10 text-teal-600">
            <GitBranch className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Card chains</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Ordered sequences for processes / step-by-step recall
            </p>
          </div>
        </div>
        {!building && (
          <Button size="sm" variant="outline" onClick={() => setBuilding([])}>
            <Plus className="h-3.5 w-3.5" /> New chain
          </Button>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        {building && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 rounded-md border bg-primary/5 p-3"
          >
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chain name (e.g. mitosis steps)"
              />
              <Button onClick={finish}>
                <Plus className="h-3.5 w-3.5" /> Save
              </Button>
              <Button variant="ghost" onClick={() => setBuilding(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ol className="space-y-1.5">
              <AnimatePresence>
                {building.map((cid, i) => {
                  const card = byId.get(cid);
                  if (!card) return null;
                  return (
                    <motion.li
                      key={cid}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-xs"
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{truncate(card.question, 70)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setBuilding(building.filter((id) => id !== cid))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a card to add..."
            />
            {candidates.length > 0 && (
              <div className="space-y-1">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (!building.includes(c.id)) {
                        setBuilding([...building, c.id]);
                        setSearch("");
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded border bg-card px-2 py-1 text-left text-xs hover:border-primary/40"
                  >
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 truncate">{truncate(c.question, 80)}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {chains.length === 0 && !building ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No chains yet. Group cards into ordered sequences for processes that
            need step-by-step recall.
          </p>
        ) : (
          chains.map((c) => <ChainRow key={c.id} chain={c} byId={byId} deckId={deckId} />)
        )}
      </CardContent>
    </Card>
  );
}

function ChainRow({
  chain,
  byId,
  deckId,
}: {
  chain: CardChain;
  byId: Map<string, ResolvedCard>;
  deckId: string;
}) {
  return (
    <div className="rounded-md border bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{chain.name}</p>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px]">
            {chain.card_ids.length} steps
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => {
              deleteChain(deckId, chain.id);
              toast.success("Chain removed");
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <ol className="mt-2 space-y-1">
        {chain.card_ids.map((cid, i) => {
          const card = byId.get(cid);
          if (!card) return null;
          return (
            <li key={cid} className="flex items-center gap-2 text-xs">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1 truncate">{truncate(card.question, 90)}</span>
              {i < chain.card_ids.length - 1 && (
                <ArrowDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
