"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CircleAlert,
  Filter,
  Frown,
  Hash,
  Lightbulb,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExplainDialog } from "@/components/explain-dialog";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { detectPatterns, gatherMistakes, type MistakeEntry } from "@/lib/mistakes";
import { useStorageVersion } from "@/lib/hooks";
import type { Card as CardData, JobSummary } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

function EmptyStateInline({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorBookShell() {
  const version = useStorageVersion();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, CardData[]>>({});
  const [explaining, setExplaining] = useState<MistakeEntry | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const map: Record<string, CardData[]> = {};
        await Promise.all(
          done.map(async (j) => {
            try {
              const d = await jobDetail(j.id);
              map[j.id] = d.cards;
            } catch {
              map[j.id] = [];
            }
          }),
        );
        setCardsByDeck(map);
      })
      .catch(() => setJobs([]));
  }, []);

  const mistakes = useMemo<MistakeEntry[]>(() => {
    if (!jobs) return [];
    const nameMap = new Map<string, string>();
    for (const j of jobs) nameMap.set(j.id, loadDeckMeta(j.id).alias || j.filename);
    return gatherMistakes(jobs, resolveDeck, cardsByDeck, nameMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, cardsByDeck, version]);

  const patterns = useMemo(() => detectPatterns(mistakes), [mistakes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of mistakes) {
      for (const t of [...m.card.tags, ...m.card.customTags]) set.add(t);
    }
    return Array.from(set).sort();
  }, [mistakes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return mistakes.filter((m) => {
      if (tagFilter && ![...m.card.tags, ...m.card.customTags].includes(tagFilter)) return false;
      if (!q) return true;
      return (
        m.card.question.toLowerCase().includes(q) ||
        m.card.answer.toLowerCase().includes(q) ||
        m.deckName.toLowerCase().includes(q)
      );
    });
  }, [mistakes, search, tagFilter]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalLapses = mistakes.reduce((acc, m) => acc + m.lapses, 0);
  const modelForExplain = explaining
    ? jobs.find((j) => j.id === explaining.deckId)?.config.model || "qwen2.5:7b-instruct"
    : "qwen2.5:7b-instruct";

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Error book
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Cards you've stumbled on
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Every card you've graded "again" at least once, ranked by lapse count.
            Click "Explain" on any card to have the local LLM walk you through it.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Tile label="Cards with lapses" value={`${mistakes.length}`} icon={Frown} tone="destructive" />
          <Tile label="Total lapses" value={`${totalLapses}`} icon={CircleAlert} tone="warn" />
          <Tile label="Patterns detected" value={`${patterns.length}`} icon={Sparkles} tone="primary" />
        </section>

        {patterns.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-destructive" /> Mistake patterns
              </CardTitle>
              <CardDescription>Topics where you're spending the most effort and learning the least.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {patterns.map((p) => (
                <button
                  key={p.tag}
                  type="button"
                  onClick={() => setTagFilter(p.tag)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md border bg-card p-3 text-left text-sm hover:border-destructive/40",
                    tagFilter === p.tag && "border-destructive bg-destructive/10",
                  )}
                >
                  <span>
                    <Hash className="inline h-3 w-3 text-muted-foreground" /> {p.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.lapses} lapses
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="font-display">All lapsed cards</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search question / answer"
                  className="h-9 w-56 text-sm"
                />
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <button
                    onClick={() => setTagFilter(null)}
                    className={cn(
                      "rounded border px-2 py-0.5",
                      tagFilter === null ? "border-primary text-primary" : "text-muted-foreground",
                    )}
                  >
                    All
                  </button>
                  {allTags.slice(0, 6).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(tagFilter === t ? null : t)}
                      className={cn(
                        "rounded border px-2 py-0.5",
                        tagFilter === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                      )}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              mistakes.length === 0 ? (
                <div className="px-6 py-12">
                  <EmptyStateInline
                    title="No mistakes yet"
                    description="Every card you mark 'again' lands here, grouped by deck with AI-explainer support. Run a session first."
                  />
                </div>
              ) : (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  Nothing matches that filter.
                </p>
              )
            ) : (
              <div className="divide-y">
                {filtered.map((m) => (
                  <MistakeRow
                    key={`${m.deckId}-${m.card.id}`}
                    entry={m}
                    onExplain={() => setExplaining(m)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ExplainDialog
        open={explaining !== null}
        onOpenChange={(o) => !o && setExplaining(null)}
        deckId={explaining?.deckId ?? ""}
        card={explaining?.card ?? null}
        model={modelForExplain}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "destructive" | "warn";
}) {
  const toneClass = {
    primary: "text-primary",
    destructive: "text-destructive",
    warn: "text-orange-500",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <p className="mt-1 font-display text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function MistakeRow({
  entry,
  onExplain,
}: {
  entry: MistakeEntry;
  onExplain: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 items-center gap-3 p-4 md:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {entry.deckName}
          </Badge>
          <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
            {entry.lapses} lapse{entry.lapses === 1 ? "" : "s"}
          </Badge>
          <span>ease {entry.ease.toFixed(2)}</span>
          {entry.last_graded && (
            <span>
              last seen{" "}
              {new Date(entry.last_graded).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="mt-1 font-medium leading-snug">{entry.card.question}</p>
        <p className="text-sm text-muted-foreground">{truncate(entry.card.answer, 200)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={onExplain}>
          <Lightbulb className="h-3.5 w-3.5" /> Explain
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/study?job=${entry.deckId}&mode=tutor` as any}>
            <Brain className="h-3.5 w-3.5" /> Tutor
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/decks/${entry.deckId}` as any}>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
