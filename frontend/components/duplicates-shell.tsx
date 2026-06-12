"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CopyCheck, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { findDuplicateGroups, type DuplicateGroup } from "@/lib/duplicates";
import type { JobSummary } from "@/lib/types";
import { truncate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

export function DuplicatesShell() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, ResolvedCard[]>>({});
  const [threshold, setThreshold] = useState(0.55);

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

  const groups = useMemo<DuplicateGroup[]>(() => {
    if (!jobs) return [];
    const decks = jobs.map((j) => ({
      deckId: j.id,
      deckName: loadDeckMeta(j.id).alias || j.filename,
      cards: cardsByDeck[j.id] ?? [],
    }));
    return findDuplicateGroups(decks, threshold);
  }, [jobs, cardsByDeck, threshold]);

  if (!jobs) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCards = Object.values(cardsByDeck).reduce((acc, c) => acc + c.length, 0);
  const totalDupes = groups.reduce((acc, g) => acc + g.matches.length, 0);

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Duplicates</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Near-duplicate cards across your decks
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cheap-but-effective Jaccard overlap on tokens. Use this when you
            generate multiple decks from related sources and want to spot the
            cards that say the same thing twice.
          </p>
        </header>

        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
            <Tile label="Cards indexed" value={totalCards.toString()} />
            <Tile label="Duplicate groups" value={groups.length.toString()} tone="warn" />
            <Tile label="Total duplicates" value={totalDupes.toString()} tone="warn" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Similarity threshold</span>
              <span className="font-mono text-xs">{Math.round(threshold * 100)}%</span>
            </div>
            <Slider value={[threshold]} min={0.3} max={0.95} step={0.05} onValueChange={(v) => setThreshold(v[0])} />
            <p className="text-xs text-muted-foreground">
              Higher = stricter. 55-65% catches paraphrases; 80%+ catches near-identical wording.
            </p>
          </CardContent>
        </Card>

        {groups.length === 0 ? (
          totalCards === 0 ? (
            <EmptyState
              icon={CopyCheck}
              title="Nothing to compare yet"
              description="Drop a chapter into the generator or import an existing deck to start finding near-duplicate cards across your library."
              cta={{ label: "Open generator", href: "/generator" }}
            />
          ) : (
            <EmptyState
              icon={CopyCheck}
              title={`No duplicates above ${Math.round(threshold * 100)}% similarity`}
              description="Lower the threshold to catch paraphrases, or raise it to find near-identical wording."
            />
          )
        ) : (
          <div className="space-y-3">
            {groups.map((g, i) => (
              <GroupCard key={`${g.representative.deckId}-${g.representative.card.id}-${i}`} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" | "default" }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3 text-center">
      <p className={`font-display text-2xl font-semibold ${tone === "warn" ? "text-orange-500" : ""}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Badge variant="outline" className="mb-1 text-[10px]">
                {group.representative.deckName}
              </Badge>
              <p className="font-medium leading-snug">
                {group.representative.card.question}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {truncate(group.representative.card.answer, 180)}
              </p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/decks/${group.representative.deckId}` as any}>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="my-3 h-px bg-border" />
          <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {group.matches.length} near-duplicate{group.matches.length === 1 ? "" : "s"}
          </p>
          <div className="space-y-2">
            {group.matches.map((m, i) => (
              <div
                key={`${m.deckId}-${m.card.id}-${i}`}
                className="rounded-md border bg-secondary/20 p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {m.deckName}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(m.similarity * 100)}% match
                  </span>
                </div>
                <p className="mt-1 font-medium">{m.card.question}</p>
                <p className="text-muted-foreground">{truncate(m.card.answer, 180)}</p>
                <div className="mt-1 flex justify-end">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/decks/${m.deckId}` as any}>
                      <Search className="h-3.5 w-3.5" /> Open
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
