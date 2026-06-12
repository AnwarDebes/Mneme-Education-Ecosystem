"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Quote, Search, Volume2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SpeakButton } from "@/components/speak-button";
import type { ResolvedCard } from "@/lib/cards";
import { cn, truncate } from "@/lib/utils";

interface FactsViewerProps {
  cards: ResolvedCard[];
}

interface FactGroup {
  fact: string;
  cards: ResolvedCard[];
}

export function FactsViewer({ cards }: FactsViewerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FactGroup | null>(null);

  const groups = useMemo<FactGroup[]>(() => {
    const map = new Map<string, ResolvedCard[]>();
    for (const c of cards) {
      const fact = (c.source_fact || "").trim();
      if (!fact) continue;
      const list = map.get(fact) ?? [];
      list.push(c);
      map.set(fact, list);
    }
    const out: FactGroup[] = [];
    for (const [fact, list] of map.entries()) {
      out.push({ fact, cards: list });
    }
    out.sort((a, b) => b.cards.length - a.cards.length || a.fact.localeCompare(b.fact));
    return out;
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.fact.toLowerCase().includes(q) ||
        g.cards.some(
          (c) =>
            c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q),
        ),
    );
  }, [groups, search]);

  if (groups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          No atomic facts attached to these cards. (Older or hand-authored cards
          may not have source facts.)
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Source facts</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {groups.length} facts - {cards.length} cards derived
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facts"
            className="h-8 w-48 pl-7 text-xs"
          />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No facts match that search.
            </p>
          ) : (
            filtered.map((g, i) => (
              <motion.button
                key={g.fact + i}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.01, 0.2) }}
                onClick={() => setSelected(g)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:border-primary/40",
                  selected?.fact === g.fact && "border-primary bg-primary/5",
                )}
              >
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm italic leading-relaxed">{truncate(g.fact, 220)}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {g.cards.length} {g.cards.length === 1 ? "card" : "cards"}
                    </Badge>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </CardContent>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="max-w-2xl rounded-xl border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Source fact
                  </p>
                  <p className="mt-1 font-display text-lg leading-relaxed">
                    {selected.fact}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <SpeakButton text={selected.fact} />
                  <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Derived cards ({selected.cards.length})
                </p>
                {selected.cards.map((c) => (
                  <div key={c.id} className="rounded-md border bg-secondary/30 p-3 text-sm">
                    <p className="font-medium">{c.question}</p>
                    <p className="mt-1 text-muted-foreground">{c.answer}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
