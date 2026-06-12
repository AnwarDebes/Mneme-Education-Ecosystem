"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Award,
  Brain,
  Briefcase,
  ChevronRight,
  Eye,
  FlaskConical,
  GraduationCap,
  Layers,
  Lightbulb,
  Network,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    title: "10 study modes",
    desc: "Flip, Quiz, Cloze, Write, Match, Speed, Cram, Test, Tutor, Listen.",
    icon: GraduationCap,
    badge: "core",
    color: "from-indigo-500/20 to-violet-500/20",
  },
  {
    title: "Local LLM authoring",
    desc: "Generate cards from a file, a URL, or pasted text; rewrite, suggest gaps, suggest tags.",
    icon: Sparkles,
    badge: "AI",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    title: "AI Tutor + Explain + Chat",
    desc: "Socratic per-card coaching, on-demand answer explanations, and chat grounded in your source.",
    icon: Lightbulb,
    badge: "AI",
    color: "from-amber-500/20 to-orange-500/20",
  },
  {
    title: "Insights that move the needle",
    desc: "Streak, heatmap, hourly accuracy, forgetting curve, learner profile, weak-tag detection.",
    icon: Eye,
    badge: "analytics",
    color: "from-rose-500/20 to-pink-500/20",
  },
  {
    title: "Curriculum & exams",
    desc: "Group decks into courses with goals, skill tree, and auto-scheduled practice exams.",
    icon: Trophy,
    badge: "long-term",
    color: "from-yellow-500/20 to-amber-500/20",
  },
  {
    title: "Rich card content",
    desc: "LaTeX, code fences, hints, images, voice memos, hand-drawn sketches, card relationships.",
    icon: FlaskConical,
    badge: "content",
    color: "from-cyan-500/20 to-sky-500/20",
  },
  {
    title: "Power-user workflow",
    desc: "Bulk edit, multi-select actions, smart shuffle, mistake-aware Cram, AnkiConnect push.",
    icon: Briefcase,
    badge: "power",
    color: "from-fuchsia-500/20 to-purple-500/20",
  },
  {
    title: "Gamification",
    desc: "XP, levels, daily quests with rewards, achievements, certificate generator.",
    icon: Award,
    badge: "delight",
    color: "from-violet-500/20 to-indigo-500/20",
  },
  {
    title: "Discovery",
    desc: "Cross-deck search, near-duplicate finder, glossary auto-extraction, concept maps.",
    icon: Network,
    badge: "discovery",
    color: "from-teal-500/20 to-emerald-500/20",
  },
  {
    title: "Anywhere, anytime",
    desc: "PWA installable, offline-ready, multi-theme (sepia / high-contrast / OLED), customizable shortcuts.",
    icon: Layers,
    badge: "platform",
    color: "from-slate-500/20 to-zinc-500/20",
  },
];

export function DemoShell() {
  return (
    <div className="container space-y-12 py-14">
      <header className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="mb-4">
          Showcase
        </Badge>
        <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Everything mneme can do, on one page.
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          A guided tour of every feature shipped across 21 phases of
          development. Click any tile to jump straight to the thing.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/library">
              Open the library <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/learn">Study the science</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className={`group relative h-full overflow-hidden bg-gradient-to-br ${f.color}`}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-card shadow-sm ring-1 ring-border">
                      <Icon className="h-5 w-5 text-foreground" />
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {f.badge}
                    </Badge>
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {f.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <Stats />

      <section className="grid gap-4 md:grid-cols-3">
        <StackCard
          title="Backend"
          items={[
            "FastAPI + uvicorn + sse-starlette",
            "18 endpoints (REST + SSE)",
            "Local Ollama via /api/chat + /api/generate",
            "SQLite for .apkg parsing on import",
            "No third-party services",
          ]}
        />
        <StackCard
          title="Frontend"
          items={[
            "Next.js 15 App Router + TypeScript",
            "Tailwind + shadcn-style components",
            "framer-motion animations",
            "Web Speech API + MediaRecorder",
            "PWA installable + service worker",
          ]}
        />
        <StackCard
          title="Local-only data"
          items={[
            "All study state in localStorage",
            "Backup / restore as JSON",
            "Browser notifications (opt-in)",
            "AnkiConnect push (your local Anki)",
            "No accounts, no telemetry",
          ]}
        />
      </section>

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/80 to-accent text-primary-foreground">
        <CardContent className="grid items-center gap-4 px-6 py-12 text-center md:grid-cols-[1fr_auto] md:text-left">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-80">
              Get started
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              Drop a chapter. Build the streak.
            </h2>
            <p className="mt-2 max-w-lg opacity-90">
              Your first deck takes under a minute. Your tenth deck arrives with
              insights, courses, and exam plans wrapped around it.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg" className="text-foreground">
            <Link href="/generator">
              Generate your first deck <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stats() {
  const stats = [
    { label: "study modes", value: "10" },
    { label: "pages", value: "20+" },
    { label: "components", value: "120+" },
    { label: "backend endpoints", value: "19" },
    { label: "theme variants", value: "4" },
    { label: "achievements", value: "12" },
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="text-center"
          >
            <p className="font-display text-3xl font-semibold tracking-tight">
              {s.value}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function StackCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <p className="font-display text-lg font-semibold">{title}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Brain className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
