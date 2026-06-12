"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notifyStorageChange, readJSON, writeJSON } from "@/lib/storage";
import type { ResolvedCard } from "@/lib/cards";
import { useStorageVersion } from "@/lib/hooks";
import { cn, truncate } from "@/lib/utils";

interface WhiteboardCanvasProps {
  deckId: string;
  cards: ResolvedCard[];
}

interface Layout {
  positions: Record<string, { x: number; y: number }>;
}

function key(deckId: string): string {
  return "whiteboard:" + deckId;
}

function loadLayout(deckId: string): Layout {
  return readJSON<Layout>(key(deckId), { positions: {} });
}

function saveLayout(deckId: string, layout: Layout): void {
  writeJSON(key(deckId), layout);
  notifyStorageChange();
}

function autoLayout(cards: ResolvedCard[]): Layout {
  const cols = Math.ceil(Math.sqrt(cards.length));
  const positions: Record<string, { x: number; y: number }> = {};
  cards.forEach((c, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positions[c.id] = { x: 30 + col * 170, y: 30 + row * 110 };
  });
  return { positions };
}

export function WhiteboardCanvas({ deckId, cards }: WhiteboardCanvasProps) {
  const version = useStorageVersion();
  const [layout, setLayout] = useState<Layout>({ positions: {} });
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const stored = loadLayout(deckId);
    if (Object.keys(stored.positions).length === 0) {
      const auto = autoLayout(cards);
      setLayout(auto);
      saveLayout(deckId, auto);
    } else {
      setLayout(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version]);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = { id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const container = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - container.left - drag.offsetX;
    const y = e.clientY - container.top - drag.offsetY;
    setLayout((l) => ({ positions: { ...l.positions, [drag.id]: { x, y } } }));
  };
  const onPointerUp = () => {
    if (dragRef.current) saveLayout(deckId, layout);
    dragRef.current = null;
  };

  if (cards.length === 0) return null;

  const reset = () => {
    const auto = autoLayout(cards);
    setLayout(auto);
    saveLayout(deckId, auto);
  };

  const width = 30 + Math.max(0, ...Object.values(layout.positions).map((p) => p.x)) + 180;
  const height = 30 + Math.max(0, ...Object.values(layout.positions).map((p) => p.y)) + 120;

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Whiteboard</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Drag cards to arrange them spatially. Saved per deck.
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" /> Auto-layout
        </Button>
      </div>
      <CardContent className="p-0">
        <div
          className="relative overflow-auto bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:18px_18px]"
          style={{ minHeight: 360, maxHeight: 540 }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="relative" style={{ width, height }}>
            {cards.map((c) => {
              const pos = layout.positions[c.id] ?? { x: 30, y: 30 };
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "absolute w-40 cursor-grab rounded-md border bg-card p-2 text-[10px] shadow-sm transition-shadow",
                    "hover:shadow-md hover:ring-1 hover:ring-primary/40",
                  )}
                  style={{ left: pos.x, top: pos.y }}
                  onPointerDown={(e) => onPointerDown(e, c.id)}
                >
                  <Badge variant="outline" className="text-[9px]">
                    {c.effective_difficulty ?? "?"}
                  </Badge>
                  <p className="mt-1 line-clamp-3 font-medium leading-snug">{truncate(c.question, 90)}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
