import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Award,
  CheckCircle2,
  Cpu,
  Flame,
  Lock,
  Repeat,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FactToCardVisualization,
  PipelineDiagram,
  StatRow,
} from "@/components/pipeline-diagram";
import { EcosystemMap, StudyModesShowcase } from "@/components/ecosystem-map";

export const metadata: Metadata = {
  title: "About",
  description: "How mneme turns a textbook into a full study ecosystem on your own machine.",
};

export default function AboutPage() {
  return (
    <div className="container space-y-20 py-16">
      <Header />
      <Pitch />
      <EcosystemSection />
      <PipelineSection />
      <FactToCardSection />
      <StudyModesSection />
      <ProgressSection />
      <StatsSection />
      <ArchitectureSection />
      <FAQ />
      <CTA />
    </div>
  );
}

function Header() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Badge variant="secondary" className="mb-4">
        About mneme
      </Badge>
      <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        How the ecosystem works, in one page.
      </h1>
      <p className="mt-4 text-pretty text-lg text-muted-foreground">
        mneme is a local-first study ecosystem. The LLM runs on your machine via
        Ollama, the cards live in your browser, and the only network call is the
        one-time Ollama model download. Everything below is what you get on day one.
      </p>
    </div>
  );
}

function Pitch() {
  const features = [
    {
      icon: Lock,
      title: "Nothing leaves your machine",
      body: "Source parsing, fact extraction, card writing, dedup, difficulty rating: all on your computer. Frontend talks only to local backend; backend talks only to local Ollama. No telemetry, no analytics, no third-party script.",
    },
    {
      icon: Sparkles,
      title: "Grounded in your source",
      body: "Cards aren't free-form. They're derived from atomic facts the LLM extracted from your text, and each card carries its source so future-you can audit \"where did this come from?\"",
    },
    {
      icon: Cpu,
      title: "Built on Ollama",
      body: "Pull any model from the Ollama library (Qwen 2.5, Llama 3.x, Gemma 3, Phi 3, ...) and mneme uses it. A 7B model is enough for most sources; a 12-14B model is noticeably better on dense chapters.",
    },
    {
      icon: CheckCircle2,
      title: "Interpretable difficulty",
      body: "Every card gets an easy/medium/hard label with a plain-English reason ('sentence-length answer; contains a number'). Opt in to a Tsetlin Machine classifier for fully interpretable difficulty rules.",
    },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {features.map((f) => (
        <Card key={f.title}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="font-display text-lg">{f.title}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function EcosystemSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="The ecosystem"
        title="One map of the whole thing"
        body="From a raw file to mastery. Every box is a feature you can use today."
      />
      <EcosystemMap />
    </section>
  );
}

function PipelineSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="The pipeline"
        title="From file to deck in eight steps"
        body="Each box runs in process. Anything tagged 'LLM' is an Ollama call; everything else is pure Python."
      />
      <PipelineDiagram />
    </section>
  );
}

function FactToCardSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="Atomic-fact grounding"
        title="One paragraph -> many cards"
        body="The LLM never writes cards directly. It extracts atomic facts first; then a second pass writes a question and answer for each fact. This 'minimum information principle' is what spaced-repetition research has linked to the highest long-term recall."
      />
      <FactToCardVisualization />
    </section>
  );
}

function StudyModesSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="Five ways to study"
        title="Different modes, different cognitive workouts"
        body="Each mode hits a different memory mechanism. Mix them across the week to build durable retention."
      />
      <StudyModesShowcase />
      <Card className="mt-6 border-primary/30 bg-primary/5">
        <CardContent className="p-5 text-sm">
          <p className="font-medium">Why five modes?</p>
          <p className="mt-1 text-muted-foreground">
            Recall under recognition (quiz) is different from free recall (cloze) is
            different from speeded recall (speed). Research shows that practicing the
            same material under varied retrieval conditions yields stronger
            long-term retention than drilling one mode. mneme lets you switch modes
            without leaving the deck.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function ProgressSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="Progress &amp; retention"
        title="Every grade you give compounds"
        body="The browser tracks every review so you can see exactly how mastery builds, without sending anything to anyone."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ProgressBlock
          icon={Flame}
          title="Daily streak"
          body="A card reviewed any time on a given day extends your streak. We don't punish missed days; your longest streak stays as a badge of honor."
          accent="text-orange-500"
        />
        <ProgressBlock
          icon={Repeat}
          title="FSRS-lite scheduling"
          body="Each grade adjusts the card's ease and next-due date using a simplified SM-2-style algorithm. Cram mode auto-queues only the ones that come due."
          accent="text-primary"
        />
        <ProgressBlock
          icon={Activity}
          title="90-day heatmap"
          body="A GitHub-style activity grid colored by the number of cards you reviewed each day. Patterns become obvious within two weeks."
          accent="text-emerald-500"
        />
        <ProgressBlock
          icon={Award}
          title="12 achievements"
          body="From First Spark (one card) through Card Connoisseur (1,000 cards). Bronze, silver, gold, and platinum tiers."
          accent="text-amber-500"
        />
        <ProgressBlock
          icon={TrendingUp}
          title="Per-deck mastery"
          body="Each deck shows due-now, learned, mastered, and lapses. Mastered = 4+ correct repetitions with no lapses."
          accent="text-success"
        />
        <ProgressBlock
          icon={Sparkles}
          title="Card edit + favorites"
          body="Tweak any generated card, add personal notes, favorite the ones you love, archive ones you don't need. All overlays live in the browser; the source deck never changes."
          accent="text-violet-500"
        />
      </div>
    </section>
  );
}

function ProgressBlock({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-2 p-5">
        <Icon className={`h-5 w-5 ${accent || ""}`} />
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function StatsSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="On a Tesla V100, Gemma 3 12B, real run"
        title="A one-page chapter, end to end."
        body="Numbers from the photosynthesis sample shipped in examples/sample.md."
      />
      <StatRow
        items={[
          { label: "Wall clock", value: "46 s", sub: "load + chunk + LLM + filter + dedup + write" },
          { label: "Atomic facts", value: "13", sub: "2 chunks, ~6 facts each" },
          { label: "Final cards", value: "17", sub: "after dedup at threshold 0.85" },
        ]}
      />
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="Architecture"
        title="Two halves, one box"
        body="The Python backend handles generation; the Next.js frontend is the entire study experience. They share a strict API contract; either could be replaced."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Backend</CardTitle>
            <CardDescription>FastAPI + uvicorn, ~400 LOC</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-2">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">POST /api/jobs</code>{" "}
                upload a file and start a generation
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">GET /api/jobs/{`{id}`}/events</code>{" "}
                Server-Sent Events stream of pipeline progress
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">GET /api/jobs/{`{id}`}/cards</code>{" "}
                JSON list of generated cards
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">GET /api/jobs/{`{id}`}/apkg</code>{" "}
                portable Anki package download
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">GET /api/health</code>{" "}
                liveness + Ollama discovery
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Frontend</CardTitle>
            <CardDescription>Next.js 15, TypeScript, Tailwind</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-2">
              <li>Library dashboard with stats, search, sort, filters</li>
              <li>Per-deck detail page with editable card list, tags, favorites</li>
              <li>Five study modes (Flip, Quiz, Cloze, Speed, Cram)</li>
              <li>FSRS-lite scheduling in localStorage, no server round-trip</li>
              <li>Streak counter, 90-day heatmap, 12 achievements</li>
              <li>Pomodoro timer, custom card author, CSV/JSON/TSV exports</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Where do my stats live?",
      a: "Only in your browser's localStorage. Clear your storage and the streak goes with it. There's no account, no sync, no server-side stats.",
    },
    {
      q: "What's the difference between FSRS-lite (in mneme) and Anki's FSRS?",
      a: "Anki's FSRS-5 fits a per-user retention model from your full review history. mneme's in-browser scheduler is a simplified SM-2-style algorithm (ease + interval) that's good enough for in-session prioritization but doesn't try to compete with Anki for long-term scheduling. Push the deck to Anki for the real thing.",
    },
    {
      q: "Do I need a GPU?",
      a: "For the mneme pipeline itself, no - it's pure Python. For the LLM, Ollama uses your GPU if you have one and falls back to CPU otherwise. CPU works but is slower; a 7B model on CPU takes ~5-10 minutes per chapter.",
    },
    {
      q: "Which Ollama model should I use?",
      a: "Qwen 2.5 7B Instruct is the smallest model that produces good cards. Gemma 3 12B is noticeably better on dense chapters; Llama 3.1 8B is a fine alternative. Anything below 4B tends to hallucinate.",
    },
    {
      q: "Will it work with cloud LLMs like GPT-4?",
      a: "The library is local-first by design. Hooking up a cloud backend is a one-file change (implement the LLMBackend protocol in mneme.llm.backend) but is not enabled by default and never will be the default.",
    },
    {
      q: "How does difficulty rating work?",
      a: "Each card is scored by a small rules-based classifier that checks for numerical answers, named entities, negation, sentence-length answers, and a few more signals. An optional interpretable Tsetlin Machine classifier (mneme.difficulty.tsetlin) learns from your own grades over time.",
    },
    {
      q: "Is my data sent anywhere?",
      a: "No. The frontend speaks only to the local FastAPI backend; the backend speaks only to local Ollama. There is no telemetry, no analytics, no third-party script.",
    },
  ];
  return (
    <section>
      <SectionHeader eyebrow="Questions" title="Plain answers." />
      <div className="space-y-3">
        {items.map((q) => (
          <Card key={q.q}>
            <CardContent className="p-5">
              <p className="font-medium">{q.q}</p>
              <p className="mt-2 text-sm text-muted-foreground">{q.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section>
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
          <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Try it on a real chapter.
          </h2>
          <p className="max-w-xl text-pretty text-primary-foreground/90">
            Drop a PDF in, watch the pipeline run, then pick a study mode. Cards
            are yours to keep, the code is MIT, the AI is local.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="secondary" size="lg" className="text-foreground">
              <Link href="/generator">Open the generator</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href={"/library" as any}>Open the library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {body && <p className="mt-3 text-pretty text-muted-foreground">{body}</p>}
    </div>
  );
}
