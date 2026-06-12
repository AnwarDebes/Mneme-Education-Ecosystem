"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { extractGlossary } from "@/lib/mistakes";
import type { ResolvedCard } from "@/lib/cards";

interface GlossaryPanelProps {
  cards: ResolvedCard[];
}

export function GlossaryPanel({ cards }: GlossaryPanelProps) {
  const [search, setSearch] = useState("");
  const entries = useMemo(() => extractGlossary(cards), [cards]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q),
    );
  }, [entries, search]);

  if (entries.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
            <Book className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Glossary</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Auto-extracted from "what is X?" cards and definition patterns
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms"
            className="h-8 w-44 pl-7 text-xs"
          />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {filtered.slice(0, 40).map((e) => (
              <motion.div
                key={e.term + e.cardId}
                layout
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-md border bg-card p-3 text-sm"
              >
                <p className="font-semibold">{e.term}</p>
                <p className="mt-0.5 text-muted-foreground">{e.definition}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length > 40 && (
            <p className="text-center text-[10px] text-muted-foreground">
              + {filtered.length - 40} more (refine search)
            </p>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {entries.length} terms total - {filtered.length} shown
        </p>
      </CardContent>
    </Card>
  );
}
