"use client";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Layers, Tag } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, difficultyTone } from "@/lib/utils";
import type { Card as CardData } from "@/lib/types";

interface CardPreviewListProps {
  cards: CardData[];
}

export function CardPreviewList({ cards }: CardPreviewListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = cards.filter((c) =>
    filter === "all" ? true : c.difficulty === filter,
  );

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        <Layers className="mx-auto h-8 w-8 opacity-40" />
        <p className="mt-3">
          Cards will appear here as the pipeline produces them.
        </p>
      </div>
    );
  }

  const counts = {
    all: cards.length,
    easy: cards.filter((c) => c.difficulty === "easy").length,
    medium: cards.filter((c) => c.difficulty === "medium").length,
    hard: cards.filter((c) => c.difficulty === "hard").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "easy", "medium", "hard"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
            className="capitalize"
          >
            {k}{" "}
            <span className="ml-1 text-xs opacity-70">{counts[k]}</span>
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((c, i) => {
          const isOpen = expanded.has(c.id);
          const tone = difficultyTone(c.difficulty);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(i, 20) * 0.015 }}
            >
              <Card
                className={cn(
                  "transition-shadow hover:shadow-md",
                  isOpen && "shadow-md",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                      tone.bg,
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", tone.fg)} />
                    ) : (
                      <ChevronRight className={cn("h-3.5 w-3.5", tone.fg)} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium leading-snug">{c.question}</p>
                      <Badge
                        className={cn("shrink-0 capitalize", tone.bg, tone.fg)}
                      >
                        {tone.label}
                      </Badge>
                    </div>
                    {!isOpen && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {c.answer}
                      </p>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <CardContent className="pt-0">
                    <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                      <p className="text-sm">{c.answer}</p>
                    </div>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      {c.source_fact && (
                        <div>
                          <p className="font-medium text-foreground">Source fact</p>
                          <p className="mt-1 italic text-muted-foreground">
                            {c.source_fact}
                          </p>
                        </div>
                      )}
                      {c.difficulty_rationale && (
                        <div>
                          <p className="font-medium text-foreground">
                            Difficulty rationale
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {c.difficulty_rationale}
                          </p>
                        </div>
                      )}
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {c.tags.map((t) => (
                          <Badge key={t} variant="outline" className="font-normal">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
