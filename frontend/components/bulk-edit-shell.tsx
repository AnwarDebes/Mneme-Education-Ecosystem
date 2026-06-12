"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Filter,
  Heart,
  Loader2,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { jobDetail } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadCustomCards } from "@/lib/custom-cards";
import {
  clearCardOverride,
  loadDeckMeta,
  toggleCardArchived,
  toggleCardFavorite,
  updateCardOverride,
} from "@/lib/deck-store";
import { useStorageVersion } from "@/lib/hooks";
import type { JobDetail } from "@/lib/types";
import { cn, difficultyTone } from "@/lib/utils";
import { toast } from "sonner";

interface BulkEditShellProps {
  deckId: string;
}

interface RowDraft {
  question: string;
  answer: string;
  tags: string;
  difficulty: "auto" | "easy" | "medium" | "hard";
}

export function BulkEditShell({ deckId }: BulkEditShellProps) {
  const version = useStorageVersion();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "edited" | "favorites" | "dirty">("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jobDetail(deckId).then(setJob).catch(() => setJob(null));
  }, [deckId]);

  const cards = useMemo<ResolvedCard[]>(() => {
    if (!job) return [];
    const custom = loadCustomCards(deckId);
    return resolveDeck(deckId, [...job.cards, ...custom]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, deckId, version]);

  const seedDraft = (c: ResolvedCard): RowDraft => ({
    question: c.question,
    answer: c.answer,
    tags: [...c.tags, ...c.customTags].join(", "),
    difficulty:
      c.effective_difficulty === c.difficulty || c.effective_difficulty == null
        ? "auto"
        : (c.effective_difficulty as RowDraft["difficulty"]),
  });

  const ensureDraft = (c: ResolvedCard): RowDraft => drafts[c.id] ?? seedDraft(c);

  const setRow = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((cur) => {
      const next = { ...cur };
      const base = next[id] ?? seedDraft(cards.find((c) => c.id === id)!);
      next[id] = { ...base, ...patch };
      return next;
    });
  };

  const isDirty = (c: ResolvedCard, d: RowDraft): boolean => {
    if (d.question !== c.question) return true;
    if (d.answer !== c.answer) return true;
    const origTags = [...c.tags, ...c.customTags].join(", ");
    if (d.tags !== origTags) return true;
    if (
      d.difficulty !==
      (c.effective_difficulty === c.difficulty || c.effective_difficulty == null
        ? "auto"
        : c.effective_difficulty)
    )
      return true;
    return false;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((c) => {
      if (c.archived && filter !== "all") return false;
      if (filter === "favorites" && !c.favorite) return false;
      if (filter === "edited" && !c.edited) return false;
      if (filter === "dirty") {
        const d = drafts[c.id];
        if (!d || !isDirty(c, d)) return false;
      }
      if (!q) return true;
      return (
        c.question.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, search, filter, drafts]);

  const dirtyCount = useMemo(
    () => cards.filter((c) => drafts[c.id] && isDirty(c, drafts[c.id])).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, drafts],
  );

  const saveAll = () => {
    setSaving(true);
    let count = 0;
    for (const c of cards) {
      const d = drafts[c.id];
      if (!d || !isDirty(c, d)) continue;
      const tags = d.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      updateCardOverride(deckId, c.id, {
        question: d.question !== c.question ? d.question : undefined,
        answer: d.answer !== c.answer ? d.answer : undefined,
        customTags: tags.length ? tags : undefined,
        difficultyOverride: d.difficulty === "auto" ? undefined : d.difficulty,
      });
      count += 1;
    }
    toast.success(`Saved ${count} card${count === 1 ? "" : "s"}`);
    setDrafts({});
    setSaving(false);
  };

  const resetCard = (c: ResolvedCard) => {
    clearCardOverride(deckId, c.id);
    setDrafts((cur) => {
      const next = { ...cur };
      delete next[c.id];
      return next;
    });
    toast.success("Card reset");
  };

  const title = job ? loadDeckMeta(deckId).alias || job.filename : "";

  if (!job) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href={`/decks/${deckId}` as any}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to deck
            </Link>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Bulk edit
            </h1>
            <p className="text-sm text-muted-foreground">
              Spreadsheet view of <span className="font-medium">{title}</span>. Edit
              in place; save dirty rows in one go.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={dirtyCount === 0}
              onClick={() => setDrafts({})}
            >
              <Undo2 className="h-4 w-4" /> Discard
            </Button>
            <Button onClick={saveAll} disabled={dirtyCount === 0 || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save {dirtyCount} change{dirtyCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/40 px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search question or answer"
                className="h-8 w-64 pl-7 text-xs"
              />
            </div>
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {(["all", "edited", "favorites", "dirty"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded border px-2.5 py-0.5 text-xs capitalize",
                  filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {f}
                {f === "dirty" && dirtyCount > 0 ? ` (${dirtyCount})` : ""}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} / {cards.length} rows
            </span>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">Question</th>
                    <th className="px-2 py-2 text-left">Answer</th>
                    <th className="px-2 py-2 text-left">Tags</th>
                    <th className="px-2 py-2 text-left">Difficulty</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => {
                    const d = ensureDraft(c);
                    const dirty = isDirty(c, d);
                    const tone = difficultyTone(c.effective_difficulty);
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "align-top",
                          dirty && "bg-amber-100/30 dark:bg-amber-500/10",
                          c.archived && "opacity-60",
                        )}
                      >
                        <td className="w-[36%] px-2 py-1.5">
                          <textarea
                            value={d.question}
                            onChange={(e) => setRow(c.id, { question: e.target.value })}
                            rows={2}
                            className="w-full resize-y rounded border bg-background px-2 py-1 text-sm"
                          />
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Badge className={cn(tone.bg, tone.fg, "text-[10px]")} variant="outline">
                              {tone.label}
                            </Badge>
                            {c.edited && <Badge variant="outline" className="text-[10px]">Edited</Badge>}
                            {c.favorite && (
                              <Badge variant="outline" className="border-rose-300/50 text-rose-600 dark:text-rose-300 text-[10px]">
                                <Heart className="h-2.5 w-2.5 fill-current" /> fav
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="w-[36%] px-2 py-1.5">
                          <textarea
                            value={d.answer}
                            onChange={(e) => setRow(c.id, { answer: e.target.value })}
                            rows={2}
                            className="w-full resize-y rounded border bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="w-[16%] px-2 py-1.5">
                          <Input
                            value={d.tags}
                            onChange={(e) => setRow(c.id, { tags: e.target.value })}
                            placeholder="tag1, tag2"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="w-[8%] px-2 py-1.5">
                          <select
                            value={d.difficulty}
                            onChange={(e) =>
                              setRow(c.id, { difficulty: e.target.value as RowDraft["difficulty"] })
                            }
                            className="h-8 w-full rounded border bg-background text-xs"
                          >
                            <option value="auto">auto</option>
                            <option value="easy">easy</option>
                            <option value="medium">medium</option>
                            <option value="hard">hard</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                toggleCardFavorite(deckId, c.id);
                              }}
                              title="Favorite"
                            >
                              <Heart
                                className={cn(
                                  "h-3.5 w-3.5",
                                  c.favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground",
                                )}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleCardArchived(deckId, c.id)}
                              title={c.archived ? "Unarchive" : "Archive"}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {c.edited && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => resetCard(c)}
                                title="Reset to original"
                              >
                                <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {dirty && (
                              <span className="text-[10px] font-medium text-amber-600">
                                <Sparkles className="inline h-3 w-3" /> dirty
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
