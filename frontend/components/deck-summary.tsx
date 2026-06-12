"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { summarizeDeck } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { readJSON, writeJSON } from "@/lib/storage";
import { formatElapsed } from "@/lib/utils";
import { toast } from "sonner";

interface DeckSummaryProps {
  deckId: string;
  model: string;
}

interface CachedSummary {
  summary: string;
  generated_at: string;
  style: "bullets" | "paragraph";
}

const KEY_PREFIX = "summary:";

function loadCached(deckId: string): CachedSummary | null {
  return readJSON<CachedSummary | null>(KEY_PREFIX + deckId, null);
}

function saveCached(deckId: string, value: CachedSummary): void {
  writeJSON(KEY_PREFIX + deckId, value);
}

export function DeckSummary({ deckId, model }: DeckSummaryProps) {
  const [cached, setCached] = useState<CachedSummary | null>(null);
  const [style, setStyle] = useState<"bullets" | "paragraph">("bullets");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCached(loadCached(deckId));
  }, [deckId]);

  const run = async () => {
    setPending(true);
    try {
      const resp = await summarizeDeck(deckId, { model, style });
      const next: CachedSummary = {
        summary: resp.summary,
        generated_at: new Date().toISOString(),
        style,
      };
      saveCached(deckId, next);
      setCached(next);
      toast.success(`Summary written in ${formatElapsed(resp.elapsed_seconds)}`);
    } catch (err: any) {
      toast.error("Could not summarize", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">AI TL;DR</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Generated from this deck's source facts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md border bg-card p-0.5 text-[10px]">
            {(["bullets", "paragraph"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`rounded-sm px-2 py-0.5 capitalize ${
                  style === s ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {cached ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <AnimatePresence mode="wait">
          {cached ? (
            <motion.div
              key={cached.generated_at}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div
                className="text-sm leading-relaxed [&_*]:leading-relaxed [&_li]:my-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(cached.summary) }}
              />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Generated {new Date(cached.generated_at).toLocaleString()} -{" "}
                <Badge variant="outline" className="text-[10px]">
                  {cached.style}
                </Badge>
              </p>
            </motion.div>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              Click "Generate" for a quick TL;DR of this deck. Uses your local
              Ollama model.
            </p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
