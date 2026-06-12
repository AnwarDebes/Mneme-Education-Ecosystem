"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Filter, Hash, Library as LibraryIcon, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import type { JobSummary } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

interface FlatCard {
  deckId: string;
  deckName: string;
  card: ResolvedCard;
}

export function GlobalCardsShell() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [flat, setFlat] = useState<FlatCard[]>([]);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const all: FlatCard[] = [];
        await Promise.all(
          done.map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              const cards = resolveDeck(j.id, d.cards).filter((c) => !c.archived);
              const name = loadDeckMeta(j.id).alias || j.filename;
              for (const c of cards) all.push({ deckId: j.id, deckName: name, card: c });
            } catch {
              /* skip */
            }
          }),
        );
        setFlat(all);
      })
      .catch(() => setJobs([]));
  }, []);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const f of flat) {
      for (const t of [...f.card.tags, ...f.card.customTags]) set.add(t);
    }
    return Array.from(set).sort().slice(0, 30);
  }, [flat]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flat
      .filter((f) => {
        if (tag && ![...f.card.tags, ...f.card.customTags].includes(tag)) return false;
        if (!q) return true;
        return (
          f.card.question.toLowerCase().includes(q) ||
          f.card.answer.toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [flat, search, tag]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="space-y-5">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cards</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Every card you own
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            One flat list across every deck. {flat.length} cards in {jobs.length} decks.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter cards"
              className="h-9 w-72 pl-8"
            />
          </div>
          {tags.length > 0 && (
            <>
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex flex-wrap gap-1 text-xs">
                <button
                  onClick={() => setTag(null)}
                  className={cn(
                    "rounded border px-2 py-0.5",
                    tag === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  Any
                </button>
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={cn(
                      "rounded border px-2 py-0.5",
                      tag === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {flat.length === 0 ? (
          <EmptyState
            icon={LibraryIcon}
            title="No cards anywhere yet"
            description="This is the flat view across every deck you've made. Generate or import a deck and they'll show up here."
            cta={{ label: "Open generator", href: "/generator" }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nothing matches that filter"
            description="Clear the tag or search to see all cards again."
          />
        ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((f, i) => (
                <motion.li
                  key={`${f.deckId}-${f.card.id}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.003, 0.5) }}
                  className="flex items-start gap-3 p-3 hover:bg-secondary/30"
                >
                  <Badge variant="outline" className="text-[10px]">
                    {f.deckName}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{truncate(f.card.question, 140)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {truncate(f.card.answer, 160)}
                    </p>
                  </div>
                  <Link
                    href={`/decks/${f.deckId}` as any}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <LibraryIcon className="h-4 w-4" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
        )}
        {filtered.length === 200 && flat.length > 200 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing first 200. Use search or tag filter to narrow.
          </p>
        )}
      </div>
    </div>
  );
}
