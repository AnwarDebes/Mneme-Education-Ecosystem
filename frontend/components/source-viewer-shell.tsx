"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Highlighter,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReadingControls } from "@/components/reading-controls";
import { jobDetail, jobSource } from "@/lib/api";
import { addCustomCard } from "@/lib/custom-cards";
import { loadDeckMeta } from "@/lib/deck-store";
import {
  HIGHLIGHT_BG,
  addHighlight,
  loadHighlights,
  removeHighlight,
  type Highlight,
  type HighlightColor,
} from "@/lib/highlights";
import { useStorageVersion } from "@/lib/hooks";
import type { JobDetail, SourceViewerResponse } from "@/lib/types";
import { toast } from "sonner";

interface SourceViewerShellProps {
  deckId: string;
}

export function SourceViewerShell({ deckId }: SourceViewerShellProps) {
  const version = useStorageVersion();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [source, setSource] = useState<SourceViewerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string>("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const highlights = useMemo(() => loadHighlights(deckId), [deckId, version]);

  useEffect(() => {
    Promise.all([jobDetail(deckId), jobSource(deckId)])
      .then(([d, s]) => {
        setJob(d);
        setSource(s);
      })
      .catch((err) => setError(String(err)));
  }, [deckId]);

  const onMouseUp = () => {
    if (typeof window === "undefined" || !source) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    setSelection(text);
    if (text) {
      const idx = source.content.indexOf(text);
      if (idx >= 0) setSelectionRange({ start: idx, end: idx + text.length });
      else setSelectionRange(null);
    } else {
      setSelectionRange(null);
    }
  };

  const persistHighlight = (color: HighlightColor) => {
    if (!selectionRange || !selection) return;
    addHighlight(deckId, selectionRange.start, selectionRange.end, selection, color);
    setSelection("");
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  };

  if (error) {
    return (
      <div className="container py-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }
  if (!job || !source) {
    return (
      <div className="container flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title = loadDeckMeta(deckId).alias || job.filename;
  const cardFromSelection = () => {
    const text = selection.trim();
    if (!text) {
      toast.error("Select some source text first");
      return;
    }
    const question = `According to the source: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}". What does this say?`;
    addCustomCard(deckId, {
      question,
      answer: text,
      tags: ["from-source"],
    });
    toast.success("Card created from highlight");
    setSelection("");
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="container py-10">
      <div className="space-y-5">
        <div>
          <Link
            href={`/decks/${deckId}` as any}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to deck
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Source</h1>
              <p className="text-sm text-muted-foreground">
                <FileText className="inline h-3.5 w-3.5" /> {title} -{" "}
                <Badge variant="outline" className="text-[10px] capitalize">
                  {source.kind}
                </Badge>{" "}
                {Math.round(source.bytes / 1024)} KB{source.truncated ? " (truncated)" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find in source"
                  className="h-9 w-56 pl-8"
                />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <ReadingControls deckId={deckId} />
          </div>
        </div>

        {selection && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-2 z-20"
          >
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Highlighter className="h-4 w-4 text-primary" />
                  <p className="truncate">"{selection.slice(0, 90)}{selection.length > 90 ? "..." : ""}"</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["yellow", "pink", "green", "blue"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => persistHighlight(c)}
                      className={`h-6 w-6 rounded ring-2 ring-transparent hover:ring-primary/40 ${HIGHLIGHT_BG[c]}`}
                      title={`Highlight ${c}`}
                    />
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setSelection("")}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={cardFromSelection}>
                    <Plus className="h-3.5 w-3.5" /> Card from highlight
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {highlights.length > 0 && (
          <Card>
            <CardContent className="space-y-1 p-3 text-xs">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Highlights ({highlights.length})
              </p>
              {highlights.slice(-8).map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                  <span className={`flex-1 truncate rounded px-1 ${HIGHLIGHT_BG[h.color]}`}>
                    "{h.text.slice(0, 100)}"
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeHighlight(deckId, h.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent
            onMouseUp={onMouseUp}
            className="prose-sm max-w-none p-6 leading-relaxed selection:bg-amber-200/50 dark:selection:bg-amber-500/30"
          >
            <SourceText source={source.content} query={search} highlights={highlights} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SourceText({
  source,
  query,
  highlights,
}: {
  source: string;
  query: string;
  highlights: Highlight[];
}) {
  const sorted = highlights.slice().sort((a, b) => a.start - b.start);
  const chunks: Array<{ text: string; highlight?: Highlight }> = [];
  let cursor = 0;
  for (const h of sorted) {
    if (h.start < cursor || h.end > source.length || h.start >= h.end) continue;
    if (h.start > cursor) chunks.push({ text: source.slice(cursor, h.start) });
    chunks.push({ text: source.slice(h.start, h.end), highlight: h });
    cursor = h.end;
  }
  if (cursor < source.length) chunks.push({ text: source.slice(cursor) });

  const q = query.trim();
  const renderPart = (text: string, key: string) => {
    if (!q) return <span key={key}>{text}</span>;
    const re = new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "ig");
    const parts = text.split(re);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} className="rounded bg-amber-200/70 px-0.5 dark:bg-amber-500/40">
              {p}
            </mark>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <pre className="whitespace-pre-wrap font-sans text-sm">
      {chunks.map((c, i) =>
        c.highlight ? (
          <span key={i} className={`${HIGHLIGHT_BG[c.highlight.color]} rounded px-0.5`}>
            {renderPart(c.text, `h-${i}`)}
          </span>
        ) : (
          renderPart(c.text, `t-${i}`)
        ),
      )}
    </pre>
  );
}
