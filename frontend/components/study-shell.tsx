"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Loader2,
  Maximize2,
  Minimize2,
  Shuffle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PomodoroTimer } from "@/components/pomodoro-timer";
import { StatsOverview } from "@/components/stats-overview";
import { FlipMode } from "@/components/study-modes/flip-mode";
import { QuizMode } from "@/components/study-modes/quiz-mode";
import { ClozeMode } from "@/components/study-modes/cloze-mode";
import { SpeedMode } from "@/components/study-modes/speed-mode";
import { CramMode } from "@/components/study-modes/cram-mode";
import { MatchMode } from "@/components/study-modes/match-mode";
import { WriteMode } from "@/components/study-modes/write-mode";

// Heavy modes (chat, speech APIs, large test machinery) load on demand to
// keep the /study first-paint bundle small.
const TestMode = dynamic(
  () => import("@/components/study-modes/test-mode").then((m) => m.TestMode),
  { ssr: false, loading: () => <ModeLoading label="Test" /> },
);
const TutorMode = dynamic(
  () => import("@/components/study-modes/tutor-mode").then((m) => m.TutorMode),
  { ssr: false, loading: () => <ModeLoading label="AI Tutor" /> },
);
const ListenMode = dynamic(
  () => import("@/components/study-modes/listen-mode").then((m) => m.ListenMode),
  { ssr: false, loading: () => <ModeLoading label="Listen" /> },
);
const VoiceOnlyMode = dynamic(
  () => import("@/components/study-modes/voice-only-mode").then((m) => m.VoiceOnlyMode),
  { ssr: false, loading: () => <ModeLoading label="Voice-only" /> },
);

function ModeLoading({ label }: { label: string }) {
  return (
    <div className="grid place-items-center py-16 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="mt-2">Loading {label} mode...</span>
    </div>
  );
}
import { smartShuffle } from "@/lib/smart-order";
import { fireConfetti } from "@/lib/confetti";
import { STUDY_MODES, type StudyMode } from "@/components/study-mode-selector";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadCustomCards } from "@/lib/custom-cards";
import { loadMultiSelection } from "@/components/multi-deck-picker";
import { loadDeckMeta } from "@/lib/deck-store";
import { dueCardIds } from "@/lib/schedule";
import { useStorageVersion } from "@/lib/hooks";
import { recordSessionMinutes } from "@/lib/stats";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { loadStats, unlock } from "@/lib/stats";
import type { JobDetail as JobDetailT, JobSummary } from "@/lib/types";
import { toast } from "sonner";

function isStudyMode(value: string | null): value is StudyMode {
  return (
    !!value &&
    ["flip", "quiz", "cloze", "speed", "cram", "match", "write", "test", "tutor", "listen", "voice-only"].includes(value)
  );
}

function applyReverse(cards: ResolvedCard[], reverse: boolean): ResolvedCard[] {
  if (!reverse) return cards;
  return cards.map((c) => ({ ...c, question: c.answer, answer: c.question }));
}

export function StudyShell() {
  const params = useSearchParams();
  const jobId = params.get("job");
  const multi = params.get("multi") === "1";
  const modeParam = params.get("mode");
  const initialMode: StudyMode = isStudyMode(modeParam) ? modeParam : "flip";

  const [job, setJob] = useState<JobDetailT | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [multiPayload, setMultiPayload] = useState<ReturnType<typeof loadMultiSelection>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StudyMode>(initialMode);
  const [sessionKey, setSessionKey] = useState(0);
  const [shuffled, setShuffled] = useState<ResolvedCard[] | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [reverse, setReverse] = useState(false);
  const version = useStorageVersion();

  useEffect(() => setMode(initialMode), [initialMode]);

  useEffect(() => {
    if (multi) {
      const payload = loadMultiSelection();
      if (payload) {
        setMultiPayload(payload);
        setLoading(false);
        return;
      }
    }
    if (!jobId) {
      listJobs()
        .then((js) => {
          setJobs(js.filter((j) => j.status === "done"));
          setLoading(false);
        })
        .catch((err) => {
          setError(String(err));
          setLoading(false);
        });
      return;
    }
    jobDetail(jobId)
      .then((d) => {
        setJob(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [jobId, multi]);

  // Check for newly-unlocked achievements after each session.
  useEffect(() => {
    const stats = loadStats();
    const newlyUnlocked: string[] = [];
    for (const a of ACHIEVEMENTS) {
      if (stats.unlocked.includes(a.id)) continue;
      if (a.check(stats)) {
        if (unlock(a.id)) newlyUnlocked.push(a.name);
      }
    }
    if (newlyUnlocked.length > 0) {
      // Burst-unlocks (e.g. first session unlocks 3 milestones at once) used
      // to spam N toasts that fought for the same spot on screen. Group them.
      if (newlyUnlocked.length === 1) {
        toast.success(`Achievement unlocked: ${newlyUnlocked[0]}`);
      } else {
        toast.success(`${newlyUnlocked.length} achievements unlocked`, {
          description: newlyUnlocked.join(", "),
          duration: 8000,
        });
      }
      fireConfetti({ particles: 60, durationMs: 2000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Listen for `?focus=1` query and ESC to toggle focus mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const resolved = useMemo<ResolvedCard[]>(() => {
    if (multiPayload) {
      return resolveDeck("__multi__", multiPayload.cards).filter((c) => !c.archived);
    }
    if (!job) return [];
    const custom = loadCustomCards(job.id);
    return resolveDeck(job.id, [...job.cards, ...custom]).filter((c) => !c.archived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, multiPayload, version]);

  const meta = useMemo(() => (job ? loadDeckMeta(job.id) : null), [job, version]);
  const dueIds = useMemo(
    () => (job ? new Set(dueCardIds(job.id, resolved.map((c) => c.id))) : new Set<string>()),
    [job, resolved],
  );

  if (loading) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container py-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <CircleAlert className="h-5 w-5" /> Backend error
            </CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (multiPayload) {
    return (
      <MultiStudyShell
        cards={resolved}
        mode={mode}
        sessionKey={sessionKey}
        setMode={(m) => {
          setMode(m);
          setSessionKey((k) => k + 1);
        }}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        deckCount={multiPayload.deckIds.length}
      />
    );
  }
  if (!jobId || !job) {
    return <JobsPicker jobs={jobs} />;
  }
  if (resolved.length === 0) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">No cards in this deck</CardTitle>
            <CardDescription>
              Looks empty. Head to the{" "}
              <Link href="/generator" className="underline">
                generator
              </Link>{" "}
              and try a different source.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const subset = applyReverse(
    mode === "cram" ? resolved : shuffled ?? resolved,
    reverse,
  );

  const title = meta?.alias || job.filename;

  return (
    <div className={focusMode ? "min-h-screen bg-background" : "container py-10"}>
      <div className={focusMode ? "container py-6" : ""}>
        <div className={focusMode ? "mx-auto max-w-3xl space-y-6" : "grid gap-6 lg:grid-cols-[1fr_280px]"}>
          <div className="space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <Link
                    href={`/decks/${job.id}` as any}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3 w-3" /> {title}
                  </Link>
                  <h1 className="font-display text-3xl font-semibold tracking-tight">Study</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{resolved.length} cards</Badge>
                  {dueIds.size > 0 && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {dueIds.size} due
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShuffled(smartShuffle(resolved));
                      setSessionKey((k) => k + 1);
                    }}
                    title="Interleaved by difficulty - stronger learning curve than random"
                  >
                    <Shuffle className="h-4 w-4" /> Smart shuffle
                  </Button>
                  <Button
                    variant={reverse ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setReverse((r) => !r);
                      setSessionKey((k) => k + 1);
                    }}
                    title="Swap question and answer"
                  >
                    <Shuffle className="h-4 w-4" /> Reverse {reverse ? "on" : "off"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFocusMode((f) => !f)}
                    title={focusMode ? "Exit focus mode (Esc)" : "Enter focus mode"}
                  >
                    {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    {focusMode ? "Exit focus" : "Focus"}
                  </Button>
                </div>
              </div>
              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setMode(v as StudyMode);
                  setSessionKey((k) => k + 1);
                }}
              >
                <TabsList className="grid w-full grid-cols-4 sm:grid-cols-11">
                  {STUDY_MODES.map((m) => (
                    <TabsTrigger key={m.id} value={m.id} className="text-[10px] sm:text-xs">
                      <m.icon className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">{m.name.split(" ")[0]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </header>

            <div key={`${mode}-${sessionKey}`}>
              {mode === "flip" && <FlipMode deckId={job.id} cards={subset} model={job.config.model} />}
              {mode === "quiz" && <QuizMode deckId={job.id} cards={subset} />}
              {mode === "cloze" && <ClozeMode deckId={job.id} cards={subset} />}
              {mode === "write" && <WriteMode deckId={job.id} cards={subset} />}
              {mode === "match" && <MatchMode deckId={job.id} cards={subset} />}
              {mode === "speed" && <SpeedMode deckId={job.id} cards={subset} />}
              {mode === "cram" && <CramMode deckId={job.id} cards={resolved} />}
              {mode === "test" && <TestMode deckId={job.id} cards={resolved} />}
              {mode === "tutor" && (
                <TutorMode deckId={job.id} cards={subset} model={job.config.model} />
              )}
              {mode === "listen" && <ListenMode deckId={job.id} cards={subset} />}
              {mode === "voice-only" && <VoiceOnlyMode deckId={job.id} cards={subset} />}
            </div>
          </div>

          {!focusMode && (
            <aside className="space-y-4">
              <PomodoroTimer onSessionComplete={(m) => recordSessionMinutes(m)} />
              <StatsOverview compact deckCount={undefined} />
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-sm">Keyboard shortcuts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  <Row k="Cmd/Ctrl+K" label="Command palette" />
                  <Row k="Space" label="Flip / submit" />
                  <Row k="1 / 2 / 3 / 4" label="Grade again / hard / good / easy" />
                  <Row k="F" label="Favorite the current card" />
                  <Row k="E" label="Edit the current card" />
                  <Row k="P" label="Pause / resume in speed mode" />
                  <Row k="Y / N" label="Got it / missed (speed)" />
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function MultiStudyShell({
  cards,
  mode,
  setMode,
  sessionKey,
  focusMode,
  setFocusMode,
  deckCount,
}: {
  cards: ResolvedCard[];
  mode: StudyMode;
  setMode: (m: StudyMode) => void;
  sessionKey: number;
  focusMode: boolean;
  setFocusMode: (f: boolean) => void;
  deckCount: number;
}) {
  return (
    <div className={focusMode ? "min-h-screen bg-background" : "container py-10"}>
      <div className={focusMode ? "container py-6" : ""}>
        <div className={focusMode ? "mx-auto max-w-3xl space-y-6" : "space-y-6"}>
          <header className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <Link
                  href={"/library" as any}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to library
                </Link>
                <h1 className="font-display text-3xl font-semibold tracking-tight">Mixed session</h1>
                <p className="text-sm text-muted-foreground">
                  {cards.length} cards from {deckCount} {deckCount === 1 ? "deck" : "decks"}.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFocusMode(!focusMode)}
              >
                {focusMode ? "Exit focus" : "Focus"}
              </Button>
            </div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as StudyMode)}>
              <TabsList className="grid w-full grid-cols-4 sm:grid-cols-11">
                {STUDY_MODES.map((m) => (
                  <TabsTrigger key={m.id} value={m.id} className="text-[10px] sm:text-xs">
                    <m.icon className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{m.name.split(" ")[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </header>
          <div key={`multi-${mode}-${sessionKey}`}>
            {mode === "flip" && <FlipMode deckId="__multi__" cards={cards} />}
            {mode === "quiz" && <QuizMode deckId="__multi__" cards={cards} />}
            {mode === "cloze" && <ClozeMode deckId="__multi__" cards={cards} />}
            {mode === "write" && <WriteMode deckId="__multi__" cards={cards} />}
            {mode === "match" && <MatchMode deckId="__multi__" cards={cards} />}
            {mode === "speed" && <SpeedMode deckId="__multi__" cards={cards} />}
            {mode === "cram" && <CramMode deckId="__multi__" cards={cards} />}
            {mode === "test" && <TestMode deckId="__multi__" cards={cards} />}
            {mode === "tutor" && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Tutor mode is per-deck; open one deck and switch to AI Tutor from there.
                </CardContent>
              </Card>
            )}
            {mode === "listen" && <ListenMode deckId="__multi__" cards={cards} />}
            {mode === "voice-only" && <VoiceOnlyMode deckId="__multi__" cards={cards} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
    </div>
  );
}

function JobsPicker({ jobs }: { jobs: JobSummary[] | null }) {
  if (jobs === null) return null;
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pick a deck to study</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a deck, or{" "}
          <Link href="/generator" className="underline">
            generate a new one
          </Link>
          . Use the{" "}
          <Link href={"/library" as any} className="underline">
            library
          </Link>{" "}
          for the full dashboard.
        </p>
        {jobs.length === 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-display">No completed decks yet</CardTitle>
              <CardDescription>Generate one first.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-6 space-y-2">
            {jobs.map((j) => (
              <Link key={j.id} href={`/study?job=${j.id}` as any} className="block">
                <Card className="transition-colors hover:bg-secondary/40">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{j.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {j.n_cards} cards - {new Date(j.created_at).toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
