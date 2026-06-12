"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Filter,
  Inbox,
  Library as LibraryIcon,
  Loader2,
  Plus,
  Search,
  SortAsc,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeckCard } from "@/components/deck-card";
import { StatsOverview } from "@/components/stats-overview";
import { AchievementsPanel } from "@/components/achievements-panel";
import { CollectionsPanel } from "@/components/collections-panel";
import { ImportDialog } from "@/components/import-dialog";
import { LevelQuestsPanel } from "@/components/level-quests-panel";
import { MultiDeckPicker } from "@/components/multi-deck-picker";
import { QuickCardsDialog } from "@/components/quick-cards-dialog";
import { SampleDecksRow } from "@/components/sample-deck-card";
import { UrlIngestDialog } from "@/components/url-ingest-dialog";
import { VisionDialog } from "@/components/vision-dialog";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { jobDetail, listJobs } from "@/lib/api";
import { loadDeckMeta } from "@/lib/deck-store";
import { dueCardIds } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";

type SortKey = "recent" | "name" | "size" | "due";
type FilterKey = "all" | "starred" | "archived";

export function LibraryShell() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [cardIdsByDeck, setCardIdsByDeck] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const version = useStorageVersion();

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        const ids: Record<string, string[]> = {};
        const limited = done.slice(0, 30);
        await Promise.all(
          limited.map(async (j) => {
            try {
              const detail = await jobDetail(j.id);
              ids[j.id] = detail.cards.map((c) => c.id);
            } catch {
              ids[j.id] = [];
            }
          }),
        );
        setCardIdsByDeck(ids);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = search.toLowerCase().trim();
    return jobs
      .filter((j) => {
        const meta = loadDeckMeta(j.id);
        if (filter === "starred" && !meta.starred) return false;
        if (filter === "archived" && !meta.archived) return false;
        if (filter === "all" && meta.archived) return false;
        if (!q) return true;
        return (meta.alias || j.filename).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sort === "name") {
          const an = (loadDeckMeta(a.id).alias || a.filename).toLowerCase();
          const bn = (loadDeckMeta(b.id).alias || b.filename).toLowerCase();
          return an.localeCompare(bn);
        }
        if (sort === "size") return b.n_cards - a.n_cards;
        const aDue = dueCardIds(a.id, cardIdsByDeck[a.id] ?? []).length;
        const bDue = dueCardIds(b.id, cardIdsByDeck[b.id] ?? []).length;
        return bDue - aDue;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, search, filter, sort, cardIdsByDeck, version]);

  const totalDue = useMemo(() => {
    if (!jobs) return 0;
    return jobs.reduce(
      (acc, j) => acc + dueCardIds(j.id, cardIdsByDeck[j.id] ?? []).length,
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, cardIdsByDeck, version]);

  if (error) {
    return (
      <div className="container py-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Backend unreachable</CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">Library</h1>
            <p className="mt-1 text-muted-foreground">
              Your decks, your streak, your stats. All in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalDue > 0 && (
              <Link href={"/today" as any} className="hidden sm:block">
                <Button variant="outline" className="gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {totalDue} due today
                </Button>
              </Link>
            )}
            <MultiDeckPicker />
            <UrlIngestDialog />
            <VisionDialog />
            <QuickCardsDialog />
            <ImportDialog />
            <Link href="/generator">
              <Button>
                <Plus className="h-4 w-4" /> New deck
              </Button>
            </Link>
          </div>
        </header>

        <StatsOverview deckCount={jobs?.length ?? 0} />

        <LevelQuestsPanel />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LibraryIcon className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">Decks</h2>
              {jobs && <Badge variant="outline">{jobs.length}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search decks"
                  className="h-9 w-56 pl-8"
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                <TabsList className="h-9">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="starred">
                    <Star className="h-3.5 w-3.5" /> Starred
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    <Inbox className="h-3.5 w-3.5" /> Archive
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <SortAsc className="h-3.5 w-3.5" /> Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSort("recent")}>
                    Most recent
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSort("name")}>
                    Name (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSort("size")}>
                    Deck size
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSort("due")}>
                    Most due
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {!jobs ? (
            // A content-shaped skeleton avoids the "blank-then-pop" layout
            // shift the spinner caused on slower fetches.
            <SkeletonCardGrid rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} hasAnyDeck={jobs.length > 0} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {filtered.map((j) => (
                  <DeckCard key={j.id} deck={j} cardIds={cardIdsByDeck[j.id] ?? []} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <CollectionsPanel jobs={jobs ?? []} />
        {jobs && jobs.length === 0 && <SampleDecksRow />}
        <AchievementsPanel />
      </div>
    </div>
  );
}

function EmptyState({ filter, hasAnyDeck }: { filter: FilterKey; hasAnyDeck: boolean }) {
  let title = "No decks yet";
  let desc = "Drop a textbook chapter into the generator and we'll do the rest.";
  let cta = (
    <Link href="/generator">
      <Button>
        <Plus className="h-4 w-4" /> Create your first deck
      </Button>
    </Link>
  );
  if (hasAnyDeck && filter === "starred") {
    title = "No starred decks";
    desc = "Star a deck to pin it here for easy access.";
    cta = (
      <Button asChild variant="outline">
        <Link href="?">Browse all decks</Link>
      </Button>
    );
  }
  if (hasAnyDeck && filter === "archived") {
    title = "Archive is empty";
    desc = "Archived decks live here. Nothing here yet.";
    cta = (
      <Button asChild variant="outline">
        <Link href="?">Browse all decks</Link>
      </Button>
    );
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Filter className="h-7 w-7" />
          </span>
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold">{title}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{desc}</p>
          </div>
          {cta}
        </CardContent>
      </Card>
    </motion.div>
  );
}
