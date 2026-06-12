"use client";
import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  Flame,
  LayoutDashboard,
  Library,
  ListChecks,
  Repeat,
  Sparkles,
  Timer,
  Trophy,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Node {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
  size?: "lg" | "md";
  tone: string;
}

const NODES: Node[] = [
  { id: "source", label: "Your source", sub: "PDF, EPUB, MD, URL", icon: Upload, x: 8, y: 36, tone: "from-slate-500/20 to-slate-400/10 text-slate-600", size: "md" },
  { id: "pipeline", label: "Pipeline", sub: "atomic facts -> cards", icon: Sparkles, x: 28, y: 36, tone: "from-primary/25 to-accent/20 text-primary", size: "lg" },
  { id: "library", label: "Library", sub: "all your decks", icon: Library, x: 50, y: 18, tone: "from-violet-500/20 to-indigo-400/10 text-violet-600", size: "md" },
  { id: "deck", label: "Deck", sub: "edit, favorite, tag", icon: LayoutDashboard, x: 50, y: 54, tone: "from-emerald-500/20 to-teal-400/10 text-emerald-600", size: "md" },
  { id: "study", label: "Study modes", sub: "5 ways to drill", icon: Brain, x: 76, y: 36, tone: "from-amber-500/25 to-orange-500/15 text-amber-600", size: "lg" },
  { id: "stats", label: "Progress", sub: "streak, heatmap, FSRS", icon: Flame, x: 92, y: 18, tone: "from-rose-500/20 to-pink-500/10 text-rose-600", size: "md" },
  { id: "trophy", label: "Mastery", sub: "achievements", icon: Trophy, x: 92, y: 54, tone: "from-yellow-400/30 to-amber-400/15 text-yellow-700", size: "md" },
];

const EDGES: Array<[string, string]> = [
  ["source", "pipeline"],
  ["pipeline", "library"],
  ["pipeline", "deck"],
  ["library", "deck"],
  ["deck", "study"],
  ["study", "stats"],
  ["study", "trophy"],
];

export function EcosystemMap() {
  const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="relative h-[360px] w-full sm:h-[440px]">
          <svg
            viewBox="0 0 100 80"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {EDGES.map(([from, to], idx) => {
              const a = nodeById[from];
              const b = nodeById[to];
              if (!a || !b) return null;
              return (
                <motion.line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth="0.35"
                  strokeDasharray="0.8 0.8"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 + idx * 0.06 }}
                />
              );
            })}
          </svg>

          {NODES.map((n, idx) => {
            const Icon = n.icon;
            const isLg = n.size === "lg";
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  className={`flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-br p-3 text-center shadow-sm ring-1 ring-inset ring-border/40 ${n.tone}`}
                  style={{
                    width: isLg ? 132 : 110,
                  }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold leading-tight text-foreground">{n.label}</p>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">{n.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Every piece runs on your machine. Solid arrows = same browser session.
          Dashed arrows = work persists in localStorage between sessions.
        </p>
      </CardContent>
    </Card>
  );
}

export function StudyModesShowcase() {
  const modes = [
    {
      icon: Repeat,
      name: "Flip",
      desc: "Classic. Reveal, grade, repeat.",
      preview: <FlipPreview />,
      accent: "text-indigo-500",
    },
    {
      icon: ListChecks,
      name: "Quiz",
      desc: "Multiple choice. Distractors come from your deck.",
      preview: <QuizPreview />,
      accent: "text-emerald-500",
    },
    {
      icon: FileText,
      name: "Cloze",
      desc: "Blank a key term in context. Type to fill it.",
      preview: <ClozePreview />,
      accent: "text-amber-500",
    },
    {
      icon: FileText,
      name: "Write",
      desc: "Free recall. Scored by key-term overlap.",
      preview: <WritePreview />,
      accent: "text-sky-500",
    },
    {
      icon: Brain,
      name: "Match",
      desc: "Pair Q with A in rounds of six.",
      preview: <MatchPreview />,
      accent: "text-teal-500",
    },
    {
      icon: Timer,
      name: "Speed",
      desc: "5s per face. Builds automatic recall.",
      preview: <SpeedPreview />,
      accent: "text-rose-500",
    },
    {
      icon: Brain,
      name: "Cram",
      desc: "Only your misses + due cards.",
      preview: <CramPreview />,
      accent: "text-fuchsia-500",
    },
    {
      icon: Trophy,
      name: "Test",
      desc: "Timed mixed-format exam. Scored at the end.",
      preview: <TestPreview />,
      accent: "text-yellow-500",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modes.map((m, idx) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: idx * 0.05 }}
        >
          <Card className="h-full overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-card ring-1 ring-border">
                  <m.icon className={`h-4 w-4 ${m.accent}`} />
                </span>
                <p className="font-display text-base font-semibold">{m.name}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
              <div className="mt-3 h-28 overflow-hidden rounded-lg border bg-muted/30 p-3">
                {m.preview}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function FlipPreview() {
  return (
    <motion.div
      animate={{ rotateY: [0, 180, 180, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.65, 1] }}
      style={{ transformStyle: "preserve-3d" }}
      className="relative mx-auto h-full max-w-[220px]"
    >
      <div className="absolute inset-0 rounded-lg border bg-card p-3 text-center text-xs" style={{ backfaceVisibility: "hidden" }}>
        <p className="text-[10px] uppercase text-muted-foreground">Question</p>
        <p className="mt-1 font-medium">Capital of France?</p>
      </div>
      <div
        className="absolute inset-0 rounded-lg border bg-primary/10 p-3 text-center text-xs"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <p className="text-[10px] uppercase text-muted-foreground">Answer</p>
        <p className="mt-1 font-medium">Paris</p>
      </div>
    </motion.div>
  );
}

function QuizPreview() {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium">What gas do plants release?</p>
      {[
        { t: "Oxygen", state: "correct" },
        { t: "Nitrogen", state: "idle" },
        { t: "Carbon dioxide", state: "idle" },
        { t: "Argon", state: "idle" },
      ].map((opt, i) => (
        <motion.div
          key={opt.t}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`flex items-center gap-1.5 rounded border bg-card px-2 py-1 ${
            opt.state === "correct" ? "border-success text-success" : ""
          }`}
        >
          <span className="grid h-4 w-4 place-items-center rounded-full bg-muted text-[10px] font-medium">
            {i + 1}
          </span>
          <span className="truncate">{opt.t}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ClozePreview() {
  return (
    <div className="text-xs leading-relaxed">
      <p>
        Water boils at{" "}
        <motion.span
          animate={{ backgroundColor: ["hsla(50, 80%, 60%, 0.3)", "hsla(50, 80%, 60%, 0.6)", "hsla(50, 80%, 60%, 0.3)"] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="rounded px-1 py-0.5 text-amber-700 dark:text-amber-300"
        >
          ____
        </motion.span>{" "}
        degrees Celsius at sea level.
      </p>
      <div className="mt-3 rounded border bg-card px-2 py-1 text-muted-foreground">
        <span className="opacity-70">type your answer...</span>
      </div>
    </div>
  );
}

function SpeedPreview() {
  return (
    <div className="relative h-full text-center">
      <motion.div
        className="absolute left-0 right-0 top-0 h-1 origin-left bg-rose-500"
        animate={{ scaleX: [0, 1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      />
      <div className="grid h-full place-items-center">
        <motion.p
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="font-display text-base font-semibold"
        >
          Mitosis vs meiosis?
        </motion.p>
      </div>
    </div>
  );
}

function CramPreview() {
  return (
    <div className="grid h-full grid-cols-5 gap-1">
      {Array.from({ length: 10 }).map((_, i) => {
        const cram = [1, 3, 4, 7, 9].includes(i);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0.4 }}
            animate={cram ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.3 }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.08 }}
            className={`rounded ${
              cram ? "bg-fuchsia-500/40 ring-1 ring-fuchsia-500" : "bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
}

function WritePreview() {
  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium">Define osmosis.</p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2, repeat: Infinity, repeatDelay: 2.5 }}
        className="rounded border bg-card px-2 py-1 text-muted-foreground"
      >
        movement of water through semipermeable membrane...
      </motion.div>
      <div className="flex gap-1">
        {["semipermeable", "water"].map((t) => (
          <span key={t} className="rounded bg-success/15 px-1.5 py-0.5 text-success">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MatchPreview() {
  return (
    <div className="grid h-full grid-cols-2 gap-1.5 text-[10px]">
      {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
        <motion.div
          key={q}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity }}
          className="rounded bg-card px-2 py-1 ring-1 ring-teal-500/40"
        >
          {q}
        </motion.div>
      ))}
      {["A1", "A2", "A3", "A4"].map((a, i) => (
        <motion.div
          key={a}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.4, delay: 0.5 + i * 0.2, repeat: Infinity }}
          className="rounded bg-teal-500/15 px-2 py-1 text-teal-600 dark:text-teal-300"
        >
          {a}
        </motion.div>
      ))}
    </div>
  );
}

function TestPreview() {
  return (
    <div className="relative grid h-full place-items-center">
      <motion.div
        initial={{ scale: 0.8, rotate: -8 }}
        animate={{ scale: [0.85, 1, 0.85], rotate: [-8, 8, -8] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-foreground shadow-md ring-2 ring-amber-400/40"
      >
        <Trophy className="h-7 w-7" />
      </motion.div>
      <p className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-muted-foreground">
        12:48 left - 7/10 correct
      </p>
    </div>
  );
}
