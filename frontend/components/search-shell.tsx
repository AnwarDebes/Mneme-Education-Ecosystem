"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, Brain, FileText, Filter, Loader2, Save, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, uniqueTags, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import {
  deleteSavedSearch,
  loadSavedSearches,
  saveSearch,
} from "@/lib/saved-searches";
import { buildIndex, searchIndex } from "@/lib/search-index";
import { useStorageVersion } from "@/lib/hooks";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import type { Card as CardData, JobSummary } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

interface Hit {
  deck: JobSummary;
  deckName: string;
  card: ResolvedCard;
  score: number;
  match: "question" | "answer" | "tag" | "note" | "fact";
}

function scoreCard(card: ResolvedCard, q: string): { score: number; field: Hit["match"] } | null {
  const ql = q.toLowerCase();
  let bestField: Hit["match"] | null = null;
  let bestScore = 0;
  const tokens = ql.split(/\s+/).filter((t) => t.length > 1);

  const fields: { name: Hit["match"]; text: string; weight: number }[] = [
    { name: "question", text: card.question, weight: 3 },
    { name: "answer", text: card.answer, weight: 2 },
    { name: "note", text: card.notes ?? "", weight: 1.5 },
    { name: "fact", text: card.source_fact ?? "", weight: 1 },
    { name: "tag", text: [...card.tags, ...card.customTags].join(" "), weight: 2 },
  ];
  for (const f of fields) {
    const lowered = f.text.toLowerCase();
    if (!lowered) continue;
    let s = 0;
    if (lowered === ql) s = 100 * f.weight;
    else if (lowered.startsWith(ql)) s = 50 * f.weight;
    else if (lowered.includes(ql)) s = 30 * f.weight;
    for (const tok of tokens) if (lowered.includes(tok)) s += 5 * f.weight;
    if (s > bestScore) {
      bestScore = s;
      bestField = f.name;
    }
  }
  return bestField ? { score: bestScore, field: bestField } : null;
}

export function SearchShell() {
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, ResolvedCard[]>>({});
  const [query, setQuery] = useState("");
  const [deckFilter, setDeckFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const saved = useMemo(() => loadSavedSearches(), [version]);

  const saveCurrent = () => {
    if (!query.trim() && !tagFilter && !deckFilter) {
      toast.error("Type a query or pick a filter first");
      return;
    }
    const name = window.prompt(
      "Name this search",
      query.trim() || tagFilter || "Saved search",
    );
    if (!name) return;
    saveSearch({ name, query, deck_id: deckFilter, tag: tagFilter });
    toast.success(`Saved "${name}"`);
  };

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const map: Record<string, ResolvedCard[]> = {};
        await Promise.all(
          done.map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              map[j.id] = resolveDeck(j.id, d.cards);
            } catch {
              map[j.id] = [];
            }
          }),
        );
        setCardsByDeck(map);
      })
      .catch(() => setJobs([]));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const cards of Object.values(cardsByDeck)) {
      for (const t of uniqueTags(cards)) set.add(t);
    }
    return Array.from(set).sort();
  }, [cardsByDeck]);

  // Build the inverted index once whenever the corpus changes; reused across
  // every keystroke. Falls back to per-card scoring for filters that the
  // index doesn't capture (deck filter, tag filter).
  const index = useMemo(() => {
    if (!jobs) return null;
    const decks = jobs.map((j) => ({ deckId: j.id, cards: cardsByDeck[j.id] ?? [] }));
    return buildIndex(decks);
  }, [jobs, cardsByDeck]);

  const hits = useMemo<Hit[]>(() => {
    if (!jobs || !query.trim() || !index) return [];
    const q = query.trim();
    const indexed = searchIndex(index, q, 200);
    const nameById = new Map(jobs.map((j) => [j.id, loadDeckMeta(j.id).alias || j.filename]));
    const out: Hit[] = [];
    for (const hit of indexed) {
      if (deckFilter && hit.deckId !== deckFilter) continue;
      if (tagFilter && ![...hit.card.tags, ...hit.card.customTags].includes(tagFilter)) continue;
      const deck = jobs.find((j) => j.id === hit.deckId);
      if (!deck) continue;
      // Pick the matching field for the chip.
      const ql = q.toLowerCase();
      const field: Hit["match"] = hit.card.question.toLowerCase().includes(ql)
        ? "question"
        : hit.card.answer.toLowerCase().includes(ql)
        ? "answer"
        : [...hit.card.tags, ...hit.card.customTags].some((t) => t.toLowerCase().includes(ql))
        ? "tag"
        : (hit.card.notes || "").toLowerCase().includes(ql)
        ? "note"
        : "fact";
      out.push({ deck, deckName: nameById.get(deck.id) || deck.filename, card: hit.card, score: hit.score, match: field });
      if (out.length >= 60) break;
    }
    return out;
  }, [jobs, index, query, deckFilter, tagFilter]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCards = Object.values(cardsByDeck).reduce((acc, c) => acc + c.length, 0);

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Search</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Find anything, fast
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Searches across every card's question, answer, tags, source fact, and
            personal notes. {totalCards} cards in {jobs.length} decks indexed.
          </p>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search question, answer, tag, note..."
              className="h-14 pl-12 text-lg"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={saveCurrent}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
          {saved.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Saved</span>
              {saved.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-0.5 rounded-full border bg-secondary/40 px-2 py-0.5 text-xs">
                  <button
                    onClick={() => {
                      setQuery(s.query);
                      setDeckFilter(s.deck_id);
                      setTagFilter(s.tag);
                    }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => {
                      deleteSavedSearch(s.id);
                      toast.success("Removed");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setDeckFilter(null)}
              className={cn(
                "rounded border px-2 py-0.5",
                deckFilter === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              All decks
            </button>
            {jobs.slice(0, 6).map((j) => {
              const m = loadDeckMeta(j.id);
              const name = m.alias || j.filename;
              const active = deckFilter === j.id;
              return (
                <button
                  key={j.id}
                  onClick={() => setDeckFilter(active ? null : j.id)}
                  className={cn(
                    "rounded border px-2 py-0.5",
                    active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {truncate(name, 20)}
                </button>
              );
            })}
            {jobs.length > 6 && <span className="text-muted-foreground">+{jobs.length - 6}</span>}
            {allTags.length > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={() => setTagFilter(null)}
                  className={cn(
                    "rounded border px-2 py-0.5",
                    tagFilter === null ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  Any tag
                </button>
                {allTags.slice(0, 8).map((t) => {
                  const active = tagFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTagFilter(active ? null : t)}
                      className={cn(
                        "rounded border px-2 py-0.5",
                        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                      )}
                    >
                      #{t}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {query.trim() === "" ? (
          <EmptyState
            icon={Search}
            title="Search every card you have"
            description="Type a word from a question, an answer, a tag, or a note. Cmd/Ctrl+K opens a faster jump-to palette for the same data."
          />
        ) : hits.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No hits for "${query}"`}
            description="Try fewer words, a different phrasing, or check that the deck containing this content is generated and not archived."
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {hits.length} result{hits.length === 1 ? "" : "s"}
            </p>
            {hits.map((h, i) => (
              <Hit key={`${h.deck.id}-${h.card.id}-${i}`} hit={h} query={query} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Hit({ hit, query }: { hit: Hit; query: string }) {
  const highlight = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const re = new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="rounded bg-amber-200/60 px-0.5 dark:bg-amber-500/30">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-3 hover:border-primary/40"
    >
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          {hit.deckName}
        </Badge>
        <Badge variant="outline" className="text-[10px] capitalize">
          match: {hit.match}
        </Badge>
        {[...hit.card.tags, ...hit.card.customTags].slice(0, 3).map((t) => (
          <span key={t} className="text-[10px]">
            #{t}
          </span>
        ))}
      </div>
      <p className="mt-1 font-medium leading-snug">{highlight(hit.card.question)}</p>
      <p className="text-sm text-muted-foreground">{highlight(truncate(hit.card.answer, 220))}</p>
      <div className="mt-2 flex justify-end gap-1.5">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/decks/${hit.deck.id}` as any}>
            <FileText className="h-3.5 w-3.5" /> Open deck
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/study?job=${hit.deck.id}` as any}>
            <Brain className="h-3.5 w-3.5" /> Study
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
