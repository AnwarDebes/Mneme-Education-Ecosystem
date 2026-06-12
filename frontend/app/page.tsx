import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  FileQuestion,
  FileText,
  Flame,
  LayoutDashboard,
  ListChecks,
  Repeat,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { DailySpotlight } from "@/components/daily-spotlight";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="container -mt-8">
        <DailySpotlight />
      </div>
      <Ecosystem />
      <StudyModes />
      <SamplePreview />
      <ProgressShowcase />
      <PrivacyAndAccess />
      <FinalCTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_80%)] bg-dot-pattern"
        style={{ backgroundSize: "32px 32px" }}
      />
      <div className="container py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 py-1.5">
            <span className="grid h-2 w-2 place-items-center">
              <span className="h-2 w-2 rounded-full bg-success" />
            </span>
            Local-first - your study notes never leave your machine
          </Badge>
          <h1 className="text-balance font-display text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            A full study ecosystem,{" "}
            <span className="bg-gradient-to-tr from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              built around your textbook
            </span>
            .
          </h1>
          <p className="mt-6 text-pretty text-lg text-muted-foreground sm:text-xl">
            Drop a PDF, EPUB, Markdown, or URL. mneme turns it into flashcards,
            quizzes, cloze drills, speed rounds, and tracks your progress with
            streaks, heatmaps, and achievements. All on your machine, no cloud.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-base">
              <Link href="/generator">
                Generate your first deck
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link href={"/library" as any}>Open the library</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Needs Ollama running locally with a model like{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              qwen2.5:7b-instruct
            </code>{" "}
            or{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              gemma3:12b
            </code>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function Ecosystem() {
  const items = [
    {
      icon: Sparkles,
      title: "Generate",
      body: "Drop a source, get cards. Local LLM, atomic-fact grounding, per-card difficulty.",
      href: "/generator",
    },
    {
      icon: LayoutDashboard,
      title: "Organize",
      body: "Library with stats, search, tags, favorites, custom names. Star the ones you love.",
      href: "/library",
    },
    {
      icon: Brain,
      title: "Study 5 ways",
      body: "Flip, quiz, fill-in-blank, speed round, cram. Pick your weapon.",
      href: "/study",
    },
    {
      icon: Flame,
      title: "Build a streak",
      body: "Daily streak, 90-day heatmap, achievements that actually mean something.",
      href: "/library",
    },
  ];
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything a serious learner needs.
        </h2>
        <p className="mt-3 text-muted-foreground">
          mneme isn't just a card generator; it's the whole loop, from source
          material to mastery, in one local app.
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body, href }) => (
          <Link key={title} href={href as any}>
            <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
                <span className="mt-auto flex items-center gap-1 text-xs font-medium text-primary">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StudyModes() {
  const modes = [
    {
      icon: Repeat,
      name: "Flip Cards",
      desc: "The classic. Show, recall, flip, grade. With FSRS-lite scheduling.",
      accent: "from-indigo-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-300",
    },
    {
      icon: ListChecks,
      name: "Quiz",
      desc: "Multiple choice. The other three options come from your own deck's answers.",
      accent: "from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-300",
    },
    {
      icon: FileQuestion,
      name: "Fill in the Blank",
      desc: "Type the answer. We blank a key term in context; strongest recall practice.",
      accent: "from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-300",
    },
    {
      icon: Timer,
      name: "Speed Round",
      desc: "5 seconds per face. Y/N grading. Trains automatic recall under pressure.",
      accent: "from-rose-500/15 to-pink-500/15 text-rose-600 dark:text-rose-300",
    },
    {
      icon: Brain,
      name: "Cram",
      desc: "Auto-queues only your due cards and prior misses. Right before the exam.",
      accent: "from-fuchsia-500/15 to-purple-500/15 text-fuchsia-600 dark:text-fuchsia-300",
    },
  ];
  return (
    <section className="border-t border-border/60 bg-secondary/30">
      <div className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Five ways to study the same deck.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Each mode trains a different cognitive skill. Combine them across the
            week for the strongest retention curve.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map(({ icon: Icon, name, desc, accent }) => (
            <Card key={name} className="group overflow-hidden">
              <CardContent className={`relative space-y-3 bg-gradient-to-br p-5 ${accent}`}>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function SamplePreview() {
  const cards = [
    {
      q: "Where do the light-dependent reactions take place?",
      a: "Thylakoid membranes",
      level: "easy" as const,
    },
    {
      q: "How many CO2 molecules are used per glucose molecule?",
      a: "Six",
      level: "easy" as const,
    },
    {
      q: "What pigment do chloroplasts contain?",
      a: "Chlorophyll",
      level: "easy" as const,
    },
    {
      q: "Why does the Calvin cycle depend on the light-dependent reactions?",
      a: "It needs the ATP and NADPH produced by the light-dependent reactions to fix carbon dioxide.",
      level: "hard" as const,
    },
  ];
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Real output from a real source.
        </h2>
        <p className="mt-3 text-muted-foreground">
          A one-page chapter on photosynthesis, Gemma 3 12B on a local V100. 22 cards in 46 seconds.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        {cards.map((c, i) => (
          <Card
            key={i}
            className="paper relative overflow-hidden transition-transform hover:-translate-y-0.5"
          >
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  Card {i + 1}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    c.level === "hard"
                      ? "border-destructive/40 text-destructive"
                      : "border-success/40 text-success"
                  }
                >
                  {c.level}
                </Badge>
              </div>
              <p className="font-display text-lg font-medium leading-snug">{c.q}</p>
              <div className="h-px bg-border" />
              <p className="text-sm text-muted-foreground">{c.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ProgressShowcase() {
  const week = [12, 18, 0, 7, 22, 35, 14];
  const maxH = Math.max(...week, 1);
  return (
    <section className="border-t border-border/60 bg-secondary/30">
      <div className="container py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Badge variant="secondary" className="mb-4">
              <Flame className="h-3.5 w-3.5 text-orange-500" /> Streaks &amp; stats
            </Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your study, visualized.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Daily streaks, 90-day activity heatmap, per-deck mastery, and a dozen
              achievements to unlock. We log every grade you make so you can see
              exactly how the work compounds.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { icon: Flame, label: "Day-by-day streak counter with grace days" },
                { icon: Award, label: "12 achievements: First Spark, Centurion, Monthly Marathon..." },
                { icon: BookOpen, label: "Per-deck stats: due now, learned, mastered, lapses" },
                { icon: Timer, label: "Pomodoro timer on the study screen" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild>
                <Link href={"/library" as any}>
                  Open the library <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      This week
                    </p>
                    <p className="font-display text-3xl font-semibold">108 cards</p>
                  </div>
                  <Badge className="bg-orange-500/10 text-orange-600" variant="outline">
                    <Flame className="h-3.5 w-3.5" /> 12-day streak
                  </Badge>
                </div>
                <div className="flex h-24 items-end gap-1.5">
                  {week.map((v, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60"
                        style={{ height: `${(v / maxH) * 100}%`, minHeight: 4 }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {["M", "T", "W", "T", "F", "S", "S"][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recent achievements
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Centurion", desc: "100 cards reviewed" },
                    { name: "Weekly Habit", desc: "7-day streak" },
                    { name: "Flawless", desc: "10 cards, 0 misses" },
                  ].map((a) => (
                    <span
                      key={a.name}
                      className="flex items-center gap-2 rounded-full border bg-gradient-to-br from-amber-400/20 to-amber-300/10 px-3 py-1 text-xs font-medium ring-1 ring-amber-300/30"
                      title={a.desc}
                    >
                      <Award className="h-3.5 w-3.5 text-amber-600" />
                      {a.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacyAndAccess() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Local-first by design",
      body: "All AI runs in Ollama on your machine. No API keys, no per-card fees, no telemetry. Your data stays yours.",
    },
    {
      icon: Sparkles,
      title: "Atomic-fact grounded",
      body: "Every card traces back to an atomic fact extracted from your source. No paraphrased duplicates, no hallucinated extras.",
    },
    {
      icon: Zap,
      title: "Per-card difficulty",
      body: "Each card is rated easy / medium / hard with a plain-English reason. Optional Tsetlin Machine classifier for interpretable scoring.",
    },
    {
      icon: FileText,
      title: "Anki-ready, plus more",
      body: ".apkg out of the box. CSV, JSON, TSV (Quizlet-compatible) too. Bring your own scheduler if you like.",
    },
  ];
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Honest, transparent, yours.
        </h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="h-full">
            <CardContent className="flex h-full flex-col gap-3 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="container py-24">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <CardContent className="flex flex-col items-center gap-6 px-6 py-16 text-center sm:py-20">
          <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop typing flashcards. Start mastering.
          </h2>
          <p className="max-w-2xl text-pretty text-primary-foreground/90">
            Drop a source, pick a study mode, build the streak. Your first deck takes under a minute.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="text-base text-foreground"
            >
              <Link href="/generator">
                Generate a deck
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href={"/library" as any}>Open the library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
