"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Book,
  Brain,
  Compass,
  FlaskConical,
  Keyboard,
  Lightbulb,
  Mic,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface HelpItem {
  id: string;
  title: string;
  body: string;
  links?: { label: string; href: string }[];
}

const SECTIONS: Record<string, { icon: React.ComponentType<{ className?: string }>; items: HelpItem[] }> = {
  start: {
    icon: Sparkles,
    items: [
      {
        id: "first-deck",
        title: "How do I make my first deck?",
        body:
          "Three ways. (1) Generator: upload a file (PDF / EPUB / Markdown) and Ollama writes cards. (2) URL: paste any HTTP(S) link to a page or PDF; the backend fetches it and runs the pipeline. (3) Import: drop in an .apkg, CSV, JSON, or paste a mneme share URL. Or load a sample.",
        links: [
          { label: "Generate", href: "/generator" },
          { label: "Import", href: "/import" },
          { label: "Showcase", href: "/showcase" },
        ],
      },
      {
        id: "study-modes",
        title: "Which study mode should I use?",
        body:
          "Start with Flip for spaced repetition. Switch to Quiz/Cloze/Write to retrieve under different conditions (this matters - varied retrieval strengthens memory). Use Tutor for cards you keep getting wrong. Test before an exam. Listen for hands-free study.",
        links: [{ label: "Learn the science", href: "/learn" }],
      },
      {
        id: "today",
        title: "What goes in 'Today'?",
        body:
          "Today aggregates every card that's due across every deck. It's the lowest-friction way to keep your streak alive: open it, run Cram on each row, you're done. Set a session goal there too.",
        links: [{ label: "Open today", href: "/today" }],
      },
    ],
  },
  ai: {
    icon: Lightbulb,
    items: [
      {
        id: "ollama",
        title: "Where does the AI run?",
        body:
          "All AI inference is via Ollama on your machine. Nothing leaves your computer. You'll need Ollama running with at least one model pulled - qwen2.5:7b-instruct is the smallest that produces good cards, gemma3:12b is sharper.",
      },
      {
        id: "ai-features",
        title: "What can the AI do?",
        body:
          "Generate cards from any source. Chat about the source. Tutor you on a single card. Explain a card you got wrong. Suggest gaps in your deck. Suggest tags. Rewrite a card (clarify / simplify / variation / harder). Translate the entire deck. Summarize the deck.",
      },
      {
        id: "ai-tutor",
        title: "How does the Tutor mode actually work?",
        body:
          "It's a per-card Socratic conversation. The LLM knows the expected answer but never reveals it; it gives hints when you're wrong, asks follow-ups when you're right, and ends the turn with a confirmation when you've shown understanding.",
      },
    ],
  },
  data: {
    icon: Book,
    items: [
      {
        id: "data-location",
        title: "Where does my data live?",
        body:
          "Three places: (1) the backend keeps generated decks in process memory + the .apkg files on disk; (2) your browser's localStorage holds every overlay - card edits, favorites, schedules, stats, plans, achievements, notes; (3) sketches and voice memos are also base64'd in localStorage. Nothing is sent anywhere else.",
      },
      {
        id: "backup",
        title: "Can I back it up?",
        body:
          "Yes. Settings -> Backup -> Export. Downloads a JSON blob of every mneme:* key. Restore on another browser or after a wipe. You can also push any deck into running Anki via the AnkiConnect plugin.",
        links: [{ label: "Open settings", href: "#" }],
      },
      {
        id: "share",
        title: "How does sharing work?",
        body:
          "Every deck has a Share URL button (under Export). It encodes the deck into the URL fragment with a SHA-256 digest. Anyone with the link can import it; the receiver verifies the signature on arrival so you know the share hasn't been tampered with in transit.",
      },
    ],
  },
  keyboard: {
    icon: Keyboard,
    items: [
      {
        id: "kbd",
        title: "Keyboard shortcuts",
        body:
          "Cmd/Ctrl+K opens the command palette - the fastest way around the app. Space flips. 1/2/3/4 grades again/hard/good/easy. F favorites, E edits. Y/N grade in speed mode. P pauses speed mode. All of these are remappable in Settings -> Shortcuts.",
        links: [{ label: "Customize shortcuts", href: "#" }],
      },
      {
        id: "voice",
        title: "Voice commands",
        body:
          "The mic button in the nav (Chrome/Edge/Safari) lets you say 'open library', 'show insights', 'start study', 'generate', etc. Useful when both hands are on a textbook.",
      },
    ],
  },
  power: {
    icon: FlaskConical,
    items: [
      {
        id: "course-mode",
        title: "What's course mode?",
        body:
          "Group decks into a collection, then open the collection's Course page. Each deck becomes a step with a goal (master / cover / maintain). The skill tree visualizes the path and locks future steps behind mastery thresholds.",
      },
      {
        id: "exam",
        title: "How do practice exams work?",
        body:
          "On Insights, schedule an exam against a deck or a collection with a target date. mneme auto-generates a study calendar on a tightening cadence (weekly far out, daily in the final week) and you can export it as .ics.",
      },
      {
        id: "retire",
        title: "Cards keep showing that I've nailed",
        body:
          "When a card hits high ease + long interval + zero lapses + ample time since last review, the deck shows a 'Mastered cards - ready to retire' panel. One click archives them in bulk. They stay in exports.",
      },
    ],
  },
};

export function HelpShell() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<keyof typeof SECTIONS>("start");

  const items = SECTIONS[tab].items.filter((it) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) || it.body.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container space-y-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Help</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Anything you can't find?
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Short answers to questions people actually ask. Use the search to jump
          across categories.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help"
          className="h-12 pl-10 text-base"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof SECTIONS)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="start">
            <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Start</span>
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="h-3.5 w-3.5" /> <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="data">
            <Book className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="keyboard">
            <Keyboard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Keys</span>
          </TabsTrigger>
          <TabsTrigger value="power">
            <FlaskConical className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Power</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it, i) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card>
              <CardContent className="space-y-2 p-5">
                <p className="font-display text-lg font-semibold">{it.title}</p>
                <p className="text-sm text-muted-foreground">{it.body}</p>
                {it.links && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {it.links.map((l) => (
                      <Button key={l.label} asChild size="sm" variant="outline">
                        <Link href={l.href as any}>
                          {l.label} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {items.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing matches "{query}" in this section. Try another tab.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="overflow-hidden bg-gradient-to-br from-primary/15 via-accent/5 to-transparent">
        <CardContent className="grid items-center gap-3 p-5 md:grid-cols-[1fr_auto]">
          <div>
            <Badge variant="outline" className="mb-1 text-[10px]">
              Tour
            </Badge>
            <p className="font-display text-xl font-semibold">
              Want the full picture?
            </p>
            <p className="text-sm text-muted-foreground">
              The Showcase page has an animated walkthrough of every feature
              shipped over 34 phases of development.
            </p>
          </div>
          <Button asChild>
            <Link href="/showcase">
              Open the tour <Compass className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
