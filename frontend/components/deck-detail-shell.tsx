"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Check,
  CircleAlert,
  Edit3,
  Heart,
  Loader2,
  PencilLine,
  Printer,
  Search,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CardEditDialog } from "@/components/card-edit-dialog";
import { ChainsPanel } from "@/components/chains-panel";
import { DeckExportMenu } from "@/components/deck-export-menu";
import { StudyModeSelector } from "@/components/study-mode-selector";
import { TagFilter } from "@/components/tag-filter";
import { AddCardDialog } from "@/components/add-card-dialog";
import { AnkiConnectButton } from "@/components/ankiconnect-button";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { TemplateAddDialog } from "@/components/template-add-dialog";
import { ChatPanel } from "@/components/chat-panel";
import { ConceptMap } from "@/components/concept-map";
import { DeckSummary } from "@/components/deck-summary";
import { DeckThemePicker } from "@/components/deck-theme-picker";
import { ExamReadinessCard } from "@/components/exam-readiness-card";
import { RetentionCard } from "@/components/retention-card";
import { styleForDeck } from "@/lib/deck-theme";
import { RetirementPanel } from "@/components/retirement-panel";
import { SnapshotsPanel } from "@/components/snapshots-panel";
import { TranslateDeckDialog } from "@/components/translate-deck-dialog";
import { FactsViewer } from "@/components/facts-viewer";
import { GlossaryPanel } from "@/components/glossary-panel";
import { ImproveCardDialog } from "@/components/improve-card-dialog";
import { LectureAudioPanel } from "@/components/lecture-audio-panel";
import { NotesPanel } from "@/components/notes-panel";
import { SnoozeMenu } from "@/components/snooze-menu";
import { StarRating } from "@/components/star-rating";
import { StudyPlanCard } from "@/components/study-plan-card";
import { SuggestCardsDialog } from "@/components/suggest-cards-dialog";
import { setCardRating, getCardRating } from "@/lib/card-ratings";
import { jobDetail } from "@/lib/api";
import { resolveDeck, uniqueTags, type ResolvedCard } from "@/lib/cards";
import { loadCustomCards } from "@/lib/custom-cards";
import {
  loadDeckMeta,
  setDeckAlias,
  toggleCardArchived,
  toggleCardFavorite,
  toggleDeckArchived,
  toggleDeckStar,
} from "@/lib/deck-store";
import { deckScheduleStats, dueCardIds } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import type { JobDetail } from "@/lib/types";
import { cn, difficultyTone, truncate } from "@/lib/utils";
import { toast } from "sonner";

interface DeckDetailShellProps {
  deckId: string;
}

export function DeckDetailShell({ deckId }: DeckDetailShellProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagsActive, setTagsActive] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "favorites" | "edited" | "due" | "archived">("all");
  const [editing, setEditing] = useState<ResolvedCard | null>(null);
  const [improving, setImproving] = useState<ResolvedCard | null>(null);
  const [suggestingOpen, setSuggestingOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");
  const [tab, setTab] = useState<"cards" | "insights" | "knowledge" | "archive">("cards");
  const [visibleCount, setVisibleCount] = useState(80);
  const version = useStorageVersion();

  useEffect(() => {
    jobDetail(deckId)
      .then((d) => setJob(d))
      .catch((err) => setError(String(err)));
  }, [deckId]);

  const cards = useMemo<ResolvedCard[]>(() => {
    if (!job) return [];
    const custom = loadCustomCards(deckId);
    return resolveDeck(deckId, [...job.cards, ...custom]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, deckId, version]);
  const meta = useMemo(() => loadDeckMeta(deckId), [deckId, version]);
  const allTags = useMemo(() => uniqueTags(cards), [cards]);
  const schedStats = useMemo(
    () => deckScheduleStats(deckId, cards.map((c) => c.id)),
    [deckId, cards, version],
  );
  const dueIds = useMemo(() => new Set(dueCardIds(deckId, cards.map((c) => c.id))), [deckId, cards, version]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((c) => {
      if (filter === "favorites" && !c.favorite) return false;
      if (filter === "edited" && !c.edited) return false;
      if (filter === "due" && !dueIds.has(c.id)) return false;
      if (filter === "archived" && !c.archived) return false;
      if (filter !== "archived" && c.archived) return false;
      if (tagsActive.length > 0) {
        const all = new Set([...c.tags, ...c.customTags]);
        if (!tagsActive.every((t) => all.has(t))) return false;
      }
      if (!q) return true;
      return (
        c.question.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [cards, search, filter, tagsActive, dueIds]);

  // Reset window when the filter set narrows or widens significantly so the
  // user always lands on the first page of fresh results.
  useEffect(() => {
    setVisibleCount(80);
  }, [search, filter, tagsActive]);

  const visible = filtered.slice(0, visibleCount);

  if (error) {
    return (
      <div className="container py-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <CircleAlert className="h-5 w-5" /> Could not load deck
            </CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const learningPct = job.n_cards ? Math.round((schedStats.learned / job.n_cards) * 100) : 0;
  const title = meta.alias || job.filename;

  return (
    <div className="container py-10" style={styleForDeck(deckId)}>
      <div className="space-y-6">
        <div>
          <Link
            href={"/library" as any}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to library
          </Link>
        </div>

        <header className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            {editingAlias ? (
              <div className="flex items-center gap-2">
                <Input
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  placeholder={job.filename}
                  autoFocus
                  className="max-w-md text-2xl font-display"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setDeckAlias(deckId, aliasDraft);
                    setEditingAlias(false);
                    toast.success("Renamed");
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  {title}
                </h1>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => {
                    setAliasDraft(meta.alias || "");
                    setEditingAlias(true);
                  }}
                >
                  rename
                </button>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Generated{" "}
              {new Date(job.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              from <span className="font-medium text-foreground">{job.filename}</span> using{" "}
              <span className="font-medium text-foreground">{job.config.model}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const s = toggleDeckStar(deckId);
                toast.success(s ? "Starred" : "Unstarred");
              }}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  meta.starred && "fill-amber-400 text-amber-400",
                )}
              />
              {meta.starred ? "Starred" : "Star"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const a = toggleDeckArchived(deckId);
                toast.success(a ? "Archived" : "Restored");
              }}
            >
              {meta.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/decks/${deckId}/source` as any}>
                <BookOpen className="h-4 w-4" /> Source
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/decks/${deckId}/edit` as any}>
                <Edit3 className="h-4 w-4" /> Bulk edit
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/decks/${deckId}/print` as any}>
                <Printer className="h-4 w-4" /> Print
              </Link>
            </Button>
            <DeckThemePicker deckId={deckId} />
            <TranslateDeckDialog deckId={deckId} deckName={title} cards={cards} model={job.config.model} />
            <AnkiConnectButton deckName={title} cards={cards} />
            <DeckExportMenu deckId={deckId} deckName={title} cards={cards} />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Study this deck</CardTitle>
              <CardDescription>Pick a mode and dive in.</CardDescription>
            </CardHeader>
            <CardContent>
              <StudyModeSelector deckId={deckId} dueCount={schedStats.due_now} totalCount={cards.length} />
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Deck stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Stat label="Cards" value={`${cards.length}`} />
                <Stat label="Due now" value={`${schedStats.due_now}`} tone={schedStats.due_now ? "primary" : "muted"} />
                <Stat label="Learned" value={`${schedStats.learned}`} />
                <Stat label="Mastered" value={`${schedStats.mastered}`} tone="success" />
                <Stat label="Lapses" value={`${schedStats.lapses}`} />
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Learning progress</span>
                    <span>{learningPct}%</span>
                  </div>
                  <Progress value={learningPct} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
            <StudyPlanCard deckId={deckId} cardCount={cards.length} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-4" aria-label="Deck workspace sections">
            <TabsTrigger value="cards" aria-label="Cards list">Cards</TabsTrigger>
            <TabsTrigger value="insights" aria-label="Retention, exam readiness, retirement">Insights</TabsTrigger>
            <TabsTrigger value="knowledge" aria-label="Summary, chat, notes, concept map, glossary">Knowledge</TabsTrigger>
            <TabsTrigger value="archive" aria-label="Snapshots and lecture audio">Audio &amp; snapshots</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-6 pt-6">
            <ExamReadinessCard deckId={deckId} cards={cards} />
            <RetentionCard deckId={deckId} cardIds={cards.map((c) => c.id)} />
            <RetirementPanel deckId={deckId} cards={cards} />
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-6 pt-6">
            <DeckSummary deckId={deckId} model={job.config.model} />
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <ChatPanel
                deckId={deckId}
                deckTitle={title}
                defaultModel={job.config.model}
                factCount={
                  new Set(
                    (job?.cards ?? [])
                      .map((c) => (c.source_fact ?? "").trim())
                      .filter(Boolean),
                  ).size
                }
              />
              <NotesPanel deckId={deckId} />
            </div>
            <FactsViewer cards={cards} />
            <ConceptMap cards={cards} />
            <ChainsPanel deckId={deckId} cards={cards} />
            <GlossaryPanel cards={cards} />
          </TabsContent>

          <TabsContent value="archive" className="space-y-6 pt-6">
            <SnapshotsPanel deckId={deckId} cards={cards} />
            <LectureAudioPanel deckId={deckId} />
          </TabsContent>

          <TabsContent value="cards" className="pt-6">

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="font-display text-lg">Cards</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <AddCardDialog deckId={deckId} />
                <TemplateAddDialog deckId={deckId} />
                <Button variant="outline" size="sm" onClick={() => setSuggestingOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> AI suggest cards
                </Button>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search cards"
                    className="h-9 w-56 pl-8"
                  />
                </div>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList className="h-9">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="due">Due</TabsTrigger>
                    <TabsTrigger value="favorites">
                      <Heart className="h-3.5 w-3.5" /> Favs
                    </TabsTrigger>
                    <TabsTrigger value="edited">Edited</TabsTrigger>
                    <TabsTrigger value="archived">Archived</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            {allTags.length > 0 && (
              <div className="mt-3">
                <TagFilter
                  tags={allTags}
                  active={tagsActive}
                  onToggle={(t) =>
                    setTagsActive((cur) =>
                      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
                    )
                  }
                  onClear={() => setTagsActive([])}
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nothing matches that filter.
              </p>
            ) : (
              <>
                <ul className="divide-y">
                  {visible.map((card) => (
                    <CardRow
                      key={card.id}
                      deckId={deckId}
                      card={card}
                      due={dueIds.has(card.id)}
                      onEdit={() => setEditing(card)}
                      onImprove={() => setImproving(card)}
                      selected={selectedIds.has(card.id)}
                      onToggleSelect={() => {
                        setSelectedIds((cur) => {
                          const n = new Set(cur);
                          if (n.has(card.id)) n.delete(card.id);
                          else n.add(card.id);
                          return n;
                        });
                      }}
                    />
                  ))}
                </ul>
                {filtered.length > visibleCount && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                    <span>
                      Showing {visibleCount} of {filtered.length}. Big decks render in pages to stay snappy.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount((c) => c + 80)}
                      >
                        Show 80 more
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVisibleCount(filtered.length)}
                      >
                        Show all {filtered.length}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CardEditDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        deckId={deckId}
        card={editing}
        allCards={cards}
      />
      <ImproveCardDialog
        open={improving !== null}
        onOpenChange={(o) => !o && setImproving(null)}
        deckId={deckId}
        card={improving}
        model={job.config.model}
      />
      <SuggestCardsDialog
        open={suggestingOpen}
        onOpenChange={setSuggestingOpen}
        deckId={deckId}
        model={job.config.model}
      />
      <BulkActionsBar
        deckId={deckId}
        cards={cards}
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "muted" | "primary" | "success" }) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-success"
      : tone === "muted"
      ? "text-muted-foreground"
      : "";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("font-display text-lg font-semibold", toneClass)}>{value}</span>
    </div>
  );
}

interface CardRowProps {
  deckId: string;
  card: ResolvedCard;
  due: boolean;
  onEdit: () => void;
  onImprove: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

function CardRow({ deckId, card, due, onEdit, onImprove, selected, onToggleSelect }: CardRowProps) {
  const tone = difficultyTone(card.effective_difficulty);
  const allTags = [...card.tags, ...card.customTags];
  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-start gap-3 py-3",
        selected && "bg-primary/5",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="mt-1.5 h-4 w-4 rounded border-primary text-primary"
        aria-label="Select card"
      />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {due && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Due
            </Badge>
          )}
          <Badge className={cn(tone.bg, tone.fg, "capitalize")} variant="outline">
            {tone.label}
          </Badge>
          {card.edited && <Badge variant="outline">Edited</Badge>}
          {allTags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] uppercase tracking-wide text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
        <p className="font-medium leading-snug">{truncate(card.question, 140)}</p>
        <p className="text-sm text-muted-foreground">{truncate(card.answer, 200)}</p>
        {card.notes && (
          <p className="rounded-md bg-amber-100/40 px-2 py-1 text-xs italic text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            note: {truncate(card.notes, 160)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1 md:flex-col md:items-end">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const fav = toggleCardFavorite(deckId, card.id);
                  toast.success(fav ? "Favorited" : "Removed from favorites");
                }}
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    card.favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{card.favorite ? "Unfavorite" : "Favorite"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit card">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onImprove} title="Improve with AI">
          <Wand2 className="h-4 w-4 text-primary" />
        </Button>
        <SnoozeMenu deckId={deckId} cardId={card.id} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const archived = toggleCardArchived(deckId, card.id);
            toast.success(archived ? "Archived card" : "Restored card");
          }}
        >
          {card.archived ? <ArchiveRestore className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
        <StarRating
          value={getCardRating(deckId, card.id)}
          onChange={(v) => setCardRating(deckId, card.id, v)}
          size="sm"
          className="md:mt-1"
        />
      </div>
    </motion.li>
  );
}
