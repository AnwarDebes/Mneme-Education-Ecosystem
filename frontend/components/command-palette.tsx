"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  Columns,
  Compass,
  CornerDownLeft,
  Files,
  GitCompare,
  GraduationCap,
  HelpCircle,
  Home,
  Library as LibraryIcon,
  Rss,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { jobDetail, listJobs } from "@/lib/api";
import { loadDeckMeta } from "@/lib/deck-store";
import type { Card as CardData, JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type CommandResult =
  | { kind: "action"; id: string; label: string; sub?: string; icon: React.ComponentType<{ className?: string }>; run: () => void }
  | { kind: "deck"; id: string; label: string; sub?: string; deckId: string; cards: number }
  | { kind: "card"; id: string; label: string; sub?: string; deckId: string; cardId: string };

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [cardsByDeck, setCardsByDeck] = useState<Record<string, CardData[]>>({});
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || jobs.length > 0) return;
    listJobs()
      .then((js) => setJobs(js.filter((j) => j.status === "done")))
      .catch(() => {});
  }, [open, jobs.length]);

  useEffect(() => {
    if (!query.trim() || jobs.length === 0) return;
    const missing = jobs.filter((j) => !cardsByDeck[j.id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.slice(0, 6).map((j) =>
        jobDetail(j.id)
          .then((d) => [j.id, d.cards] as const)
          .catch(() => [j.id, [] as CardData[]] as const),
      ),
    ).then((entries) => {
      setCardsByDeck((cur) => {
        const next = { ...cur };
        for (const [id, cards] of entries) next[id] = cards;
        return next;
      });
    });
  }, [query, jobs, cardsByDeck]);

  const results = useMemo<CommandResult[]>(() => {
    const q = query.toLowerCase().trim();
    const actions: CommandResult[] = [
      { kind: "action", id: "go-home", label: "Home", icon: Home, run: () => router.push("/") },
      { kind: "action", id: "go-library", label: "Open library", icon: LibraryIcon, run: () => router.push("/library" as any) },
      { kind: "action", id: "go-today", label: "Today's review queue", icon: CalendarDays, run: () => router.push("/today" as any) },
      { kind: "action", id: "go-insights", label: "Insights & analytics", icon: BarChart3, run: () => router.push("/insights" as any) },
      { kind: "action", id: "go-mistakes", label: "Mistakes / error book", icon: AlertCircle, run: () => router.push("/mistakes" as any) },
      { kind: "action", id: "go-search", label: "Cross-deck search", icon: Search, run: () => router.push("/search" as any) },
      { kind: "action", id: "go-feed", label: "Activity feed", icon: Rss, run: () => router.push("/feed" as any) },
      { kind: "action", id: "go-cards", label: "All cards (flat view)", icon: Files, run: () => router.push("/cards" as any) },
      { kind: "action", id: "go-compare", label: "Compare decks", icon: GitCompare, run: () => router.push("/compare" as any) },
      { kind: "action", id: "go-duplicates", label: "Find duplicate cards", icon: Columns, run: () => router.push("/duplicates" as any) },
      { kind: "action", id: "go-learn", label: "Memory-science lessons (Learn)", icon: GraduationCap, run: () => router.push("/learn" as any) },
      { kind: "action", id: "go-help", label: "Help center", icon: HelpCircle, run: () => router.push("/help" as any) },
      { kind: "action", id: "go-showcase", label: "Feature showcase", icon: Sparkles, run: () => router.push("/showcase" as any) },
      { kind: "action", id: "go-generator", label: "Generate a new deck", icon: Sparkles, run: () => router.push("/generator") },
      { kind: "action", id: "go-import", label: "Import a deck (.apkg, CSV, JSON, share URL)", icon: Sparkles, run: () => router.push("/import" as any) },
      {
        kind: "action",
        id: "open-vision",
        label: "Generate cards from an image (vision)",
        icon: Camera,
        run: () => {
          router.push("/library" as any);
          window.dispatchEvent(new Event("mneme:open-vision"));
        },
      },
      { kind: "action", id: "go-study", label: "Pick a deck to study", icon: BookOpen, run: () => router.push("/study") },
      { kind: "action", id: "go-about", label: "How mneme works (About)", icon: Compass, run: () => router.push("/about") },
    ];

    const deckResults: CommandResult[] = jobs.map((j) => {
      const meta = loadDeckMeta(j.id);
      return {
        kind: "deck",
        id: `deck-${j.id}`,
        label: meta.alias || j.filename,
        sub: `${j.n_cards} cards`,
        deckId: j.id,
        cards: j.n_cards,
      };
    });

    if (!q) {
      return [...actions, ...deckResults.slice(0, 5)];
    }

    const filteredActions = actions.filter((a) => a.label.toLowerCase().includes(q));
    const filteredDecks = deckResults.filter((d) => d.label.toLowerCase().includes(q));

    const cardHits: CommandResult[] = [];
    for (const j of jobs) {
      const cards = cardsByDeck[j.id];
      if (!cards) continue;
      for (const c of cards) {
        if (cardHits.length >= 12) break;
        if (c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q)) {
          const meta = loadDeckMeta(j.id);
          cardHits.push({
            kind: "card",
            id: `card-${j.id}-${c.id}`,
            label: c.question,
            sub: `${meta.alias || j.filename} - ${c.answer.slice(0, 60)}`,
            deckId: j.id,
            cardId: c.id,
          });
        }
      }
    }

    return [...filteredActions, ...filteredDecks, ...cardHits];
  }, [query, jobs, cardsByDeck, router]);

  const runResult = (r: CommandResult) => {
    if (r.kind === "action") r.run();
    if (r.kind === "deck") router.push(`/decks/${r.deckId}` as any);
    if (r.kind === "card") router.push(`/decks/${r.deckId}?focus=${r.cardId}` as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="border-b px-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search decks, cards, or jump to a page"
              className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(results.length - 1, h + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const r = results[highlight];
                  if (r) runResult(r);
                }
              }}
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches. Try a deck name, a card text, or "generate".
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((r, i) => {
                const Icon =
                  r.kind === "action"
                    ? r.icon
                    : r.kind === "deck"
                    ? Brain
                    : BookOpen;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => runResult(r)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm",
                        i === highlight ? "bg-secondary" : "hover:bg-secondary/50",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.label}</p>
                          {r.sub && <p className="truncate text-xs text-muted-foreground">{r.sub}</p>}
                        </div>
                      </div>
                      {i === highlight && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-secondary/40 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>
            <kbd className="rounded border bg-card px-1.5">↑↓</kbd> navigate
            <kbd className="ml-2 rounded border bg-card px-1.5">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded border bg-card px-1.5">Esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommandPaletteProvider({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
