"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Network, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ResolvedCard } from "@/lib/cards";
import { cn, truncate } from "@/lib/utils";

interface ConceptMapProps {
  cards: ResolvedCard[];
  className?: string;
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  cardCount: number;
}

interface GraphEdge {
  a: string;
  b: string;
  weight: number;
}

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","of","in","on","at","to","for","and",
  "or","but","with","by","as","from","that","this","be","been","being","it",
  "its","into","than","then","what","which","who","whom","whose","why","how",
  "do","does","did","not","no","yes","can","could","would","should","will",
  "their","there","these","those","one","two","three","first","second","most",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
}

function buildGraph(cards: ResolvedCard[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Pick top concepts: pool tags + frequent question/answer terms.
  const counts = new Map<string, number>();
  const occurrences = new Map<string, Set<string>>();
  for (const c of cards) {
    const set = new Set<string>();
    for (const t of [...c.tags, ...c.customTags]) set.add(t.toLowerCase());
    for (const t of tokens(c.question)) set.add(t);
    for (const t of tokens(c.answer)) set.add(t);
    for (const t of set) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
      if (!occurrences.has(t)) occurrences.set(t, new Set());
      occurrences.get(t)!.add(c.id);
    }
  }

  const sorted = Array.from(counts.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18);

  const nodes: GraphNode[] = sorted.map(([label, n], i) => {
    const angle = (i / sorted.length) * Math.PI * 2;
    return {
      id: label,
      label,
      x: 200 + Math.cos(angle) * 160,
      y: 180 + Math.sin(angle) * 130,
      vx: 0,
      vy: 0,
      size: 8 + Math.log2(n + 1) * 4,
      cardCount: n,
    };
  });

  const idSet = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].id;
      const b = nodes[j].id;
      const setA = occurrences.get(a);
      const setB = occurrences.get(b);
      if (!setA || !setB) continue;
      let overlap = 0;
      for (const card of setA) if (setB.has(card)) overlap += 1;
      if (overlap >= 2 && idSet.has(a) && idSet.has(b)) {
        edges.push({ a, b, weight: overlap });
      }
    }
  }
  return { nodes, edges };
}

// Tiny force-directed layout. ~30 iterations is enough for a small graph.
function layout(nodes: GraphNode[], edges: GraphEdge[], iterations = 60) {
  const W = 480;
  const H = 360;
  const k = 60; // ideal distance
  const cx = W / 2;
  const cy = H / 2;
  const byId: Record<string, GraphNode> = {};
  for (const n of nodes) byId[n.id] = n;

  for (let iter = 0; iter < iterations; iter++) {
    const damping = 0.85;
    // Repulsive forces
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const force = (k * k) / dist2;
        const ux = (dx / Math.sqrt(dist2)) * force * 0.05;
        const uy = (dy / Math.sqrt(dist2)) * force * 0.05;
        a.vx += ux;
        a.vy += uy;
        b.vx -= ux;
        b.vy -= uy;
      }
    }
    // Attractive forces along edges
    for (const e of edges) {
      const a = byId[e.a];
      const b = byId[e.b];
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = (dist * dist) / k * 0.0015 * Math.log2(e.weight + 1);
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      a.vx -= ux;
      a.vy -= uy;
      b.vx += ux;
      b.vy += uy;
    }
    // Gravity toward center
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.005;
      n.vy += (cy - n.y) * 0.005;
    }
    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Keep within bounds
      n.x = Math.max(40, Math.min(W - 40, n.x));
      n.y = Math.max(40, Math.min(H - 40, n.y));
    }
  }
  return nodes;
}

export function ConceptMap({ cards, className }: ConceptMapProps) {
  const [hover, setHover] = useState<GraphNode | null>(null);
  const data = useMemo(() => {
    const { nodes, edges } = buildGraph(cards);
    layout(nodes, edges);
    return { nodes, edges };
  }, [cards]);

  if (data.nodes.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Not enough overlap yet to draw a concept map. Try a deck with more cards or tags.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
            <Network className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Concept map</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {data.nodes.length} concepts, {data.edges.length} co-occurrences
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" /> auto
        </Badge>
      </div>
      <CardContent className="p-4">
        <div className="relative">
          <svg viewBox="0 0 480 360" className="h-[360px] w-full">
            {data.edges.map((e, i) => {
              const a = data.nodes.find((n) => n.id === e.a)!;
              const b = data.nodes.find((n) => n.id === e.b)!;
              return (
                <motion.line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="hsl(var(--primary) / 0.25)"
                  strokeWidth={Math.min(3, 0.8 + Math.log2(e.weight + 1) * 0.6)}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: i * 0.01, duration: 0.5 }}
                />
              );
            })}
            {data.nodes.map((n, i) => (
              <motion.g
                key={n.id}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.02 }}
                className="cursor-pointer"
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.size}
                  fill={hover?.id === n.id ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.7)"}
                  stroke="hsl(var(--card))"
                  strokeWidth="2"
                />
                <text
                  x={n.x}
                  y={n.y + n.size + 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="500"
                  fill="hsl(var(--foreground))"
                >
                  {truncate(n.label, 16)}
                </text>
              </motion.g>
            ))}
          </svg>
          {hover && (
            <div className="absolute right-2 top-2 rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
              <p className="font-semibold">#{hover.label}</p>
              <p className="text-muted-foreground">{hover.cardCount} occurrences</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Each circle is a recurring concept (size = how often it appears). Lines
          connect concepts that co-occur in the same card.
        </p>
      </CardContent>
    </Card>
  );
}
