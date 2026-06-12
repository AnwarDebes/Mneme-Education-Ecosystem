"use client";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Database,
  Filter,
  GraduationCap,
  ListTree,
  PackageCheck,
  Scissors,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  icon: typeof Brain;
  title: string;
  body: string;
  tag?: string;
}

const STEPS: Step[] = [
  {
    icon: Database,
    title: "Load",
    body: "Read the PDF, EPUB, Markdown, HTML, or URL into plain text.",
  },
  {
    icon: Scissors,
    title: "Chunk",
    body: "Split the text on headings and paragraphs, capped at ~600 tokens with a small overlap.",
  },
  {
    icon: ListTree,
    title: "Atomic facts",
    body: "Local LLM (Ollama) extracts up to 8 atomic claims from each chunk.",
    tag: "LLM",
  },
  {
    icon: Sparkles,
    title: "Q/A generation",
    body: "For each fact the LLM writes one or two question-answer pairs following the minimum-information principle.",
    tag: "LLM",
  },
  {
    icon: Filter,
    title: "Quality filter",
    body: "Heuristic drops yes/no cards, definitional loops, and low-information answers.",
  },
  {
    icon: Brain,
    title: "Dedup + difficulty",
    body: "Cosine-similarity de-duplication via local embeddings; per-card difficulty with a plain-English rationale.",
    tag: "TM optional",
  },
  {
    icon: PackageCheck,
    title: "Anki deck",
    body: "Write a portable .apkg file or push directly into a running Anki via AnkiConnect.",
  },
  {
    icon: GraduationCap,
    title: "Study",
    body: "Either in the browser flip-card mode (this site) or in Anki itself with FSRS scheduling.",
  },
];

export function PipelineDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, i) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <PipelineStep step={step} index={i} />
        </motion.div>
      ))}
    </div>
  );
}

function PipelineStep({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
      {step.tag && (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
          <Sparkles className="h-3 w-3" /> {step.tag}
        </span>
      )}
    </div>
  );
}

export function ArrowsRow() {
  return (
    <div className="hidden items-center justify-center gap-3 lg:flex">
      {[...Array(7)].map((_, i) => (
        <ArrowRight key={i} className="h-5 w-5 text-muted-foreground/60" />
      ))}
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string; sub: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function FactToCardVisualization() {
  return (
    <div className="rounded-xl border bg-secondary/30 p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <SourceParagraph />
        <ArrowJoin />
        <Cards />
      </div>
    </div>
  );
}

function SourceParagraph() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Database className="h-3.5 w-3.5" /> Source text
      </div>
      <p className="text-sm leading-relaxed">
        Photosynthesis is the process by which green plants convert{" "}
        <Highlight tone="primary">sunlight, water, and carbon dioxide</Highlight>{" "}
        into <Highlight tone="accent">glucose and oxygen</Highlight>. It occurs
        primarily in the <Highlight tone="primary">chloroplasts</Highlight> of
        plant cells, where the green pigment{" "}
        <Highlight tone="accent">chlorophyll</Highlight> absorbs light energy.
      </p>
    </div>
  );
}

function Highlight({ children, tone }: { children: ReactNode; tone: "primary" | "accent" }) {
  return (
    <mark
      className={
        tone === "primary"
          ? "rounded bg-primary/15 px-0.5 text-primary"
          : "rounded bg-accent/20 px-0.5 text-accent-foreground"
      }
    >
      {children}
    </mark>
  );
}

function ArrowJoin() {
  return (
    <div className="flex items-center justify-center text-muted-foreground/60">
      <ArrowRight className="hidden h-6 w-6 lg:block" />
      <div className="h-6 w-px lg:hidden" />
    </div>
  );
}

function Cards() {
  const cards = [
    {
      q: "What are the primary inputs for photosynthesis?",
      a: "Sunlight, water, and carbon dioxide",
      tone: "easy" as const,
    },
    {
      q: "What two substances does photosynthesis produce?",
      a: "Glucose and oxygen",
      tone: "easy" as const,
    },
    {
      q: "What pigment do chloroplasts contain?",
      a: "Chlorophyll",
      tone: "easy" as const,
    },
  ];
  return (
    <div className="space-y-2">
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="rounded-lg border bg-card p-3 shadow-sm"
        >
          <p className="text-sm font-medium leading-snug">{c.q}</p>
          <p className="mt-1 text-xs text-muted-foreground">{c.a}</p>
        </motion.div>
      ))}
    </div>
  );
}
