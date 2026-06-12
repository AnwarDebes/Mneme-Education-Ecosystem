"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, GraduationCap, Library, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDrop } from "@/components/file-drop";
import { PipelineProgress } from "@/components/pipeline-progress";
import { CardPreviewList } from "@/components/card-preview-list";
import {
  apkgUrl,
  createJob,
  health,
  jobDetail,
  openJobStream,
} from "@/lib/api";
import type {
  HealthResponse,
  JobDetail as JobDetailT,
  JobStatus,
  StageEvent,
} from "@/lib/types";

export function GeneratorShell() {
  const router = useRouter();

  // Health and Ollama discovery.
  const [healthInfo, setHealthInfo] = useState<HealthResponse | null>(null);
  useEffect(() => {
    health()
      .then(setHealthInfo)
      .catch((err) =>
        toast.error("Cannot reach mneme backend", {
          description: `${err.message || err}. Start it with: uvicorn mneme.server.app:app --port 8000`,
        }),
      );
  }, []);

  // Input config.
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("");
  const [deckName, setDeckName] = useState("");
  const [maxFacts, setMaxFacts] = useState(8);
  const [maxCards, setMaxCards] = useState(2);
  const [dedupThreshold, setDedupThreshold] = useState(0.85);

  // Default the model selector to whatever Ollama has pulled.
  useEffect(() => {
    if (!model && healthInfo?.ollama_models?.length) {
      const pref =
        healthInfo.ollama_models.find((m) => /qwen2\.5|llama3|gemma3/i.test(m)) ||
        healthInfo.ollama_models[0];
      setModel(pref);
    }
  }, [healthInfo, model]);

  // Job state.
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("pending");
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [detail, setDetail] = useState<JobDetailT | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Tear down the SSE on unmount or restart.
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Pick a file first");
      return;
    }
    if (!model) {
      toast.error("No Ollama model available", {
        description: "Pull one first: ollama pull qwen2.5:7b-instruct",
      });
      return;
    }
    setSubmitting(true);
    setEvents([]);
    setDetail(null);
    setStatus("loading");
    try {
      const job = await createJob(file, {
        model,
        deck_name: deckName.trim() || null,
        max_facts_per_chunk: maxFacts,
        max_cards_per_fact: maxCards,
        dedup_threshold: dedupThreshold,
        difficulty_backend: "heuristic",
        seed: 42,
        base_url: "http://localhost:11434",
      });
      setJobId(job.id);
      // Open SSE for live progress.
      const es = openJobStream(job.id, {
        onStage: (evt) => {
          setEvents((prev) => [...prev, evt]);
          setStatus(evt.stage);
        },
        onEnd: async () => {
          setStatus("done");
          try {
            const final = await jobDetail(job.id);
            setDetail(final);
            toast.success(`${final.cards.length} cards generated`);
          } catch (err) {
            toast.error("Could not fetch results", { description: String(err) });
          }
        },
        onError: () => {
          toast.error("Connection to backend lost");
        },
      });
      esRef.current = es;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Could not start the job", { description: message });
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const onStartStudying = () => {
    if (!jobId) return;
    router.push(`/study?job=${jobId}` as any);
  };

  const isRunning = jobId !== null && status !== "done" && status !== "error";
  const isFinished = jobId !== null && status === "done";

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-3xl">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Generate a deck
          </h1>
          <p className="text-muted-foreground">
            Drop a file, tune a few options, and watch the pipeline run in real time.
          </p>
        </div>

        {healthInfo && !healthInfo.ollama_reachable && (
          <div className="mt-6 rounded-lg border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
            <p className="font-medium">Ollama is not reachable.</p>
            <p className="mt-1 opacity-90">
              Start Ollama and pull a model:{" "}
              <code className="rounded bg-warn/10 px-1.5 py-0.5 font-mono text-xs">
                ollama pull qwen2.5:7b-instruct
              </code>
            </p>
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="font-display">1. Source</CardTitle>
            <CardDescription>
              PDF, EPUB, Markdown, HTML, or plain text - up to 25 MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileDrop file={file} onFileChange={setFile} disabled={isRunning} />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-display">2. Options</CardTitle>
            <CardDescription>
              Sensible defaults for most sources. Tune if a chapter has many short
              facts or a few long ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model">Ollama model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" disabled={isRunning}>
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {(healthInfo?.ollama_models || []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deck">Deck name</Label>
                <Input
                  id="deck"
                  placeholder="(filename stem)"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              <ScalarSlider
                label="Facts per chunk"
                value={maxFacts}
                min={2}
                max={20}
                step={1}
                onChange={setMaxFacts}
                disabled={isRunning}
                hint="Upper bound on how many atomic claims to extract per chunk."
              />
              <ScalarSlider
                label="Cards per fact"
                value={maxCards}
                min={1}
                max={5}
                step={1}
                onChange={setMaxCards}
                disabled={isRunning}
                hint="Higher = more cards but more redundancy."
              />
              <ScalarSlider
                label="Dedup threshold"
                value={dedupThreshold}
                min={0.6}
                max={0.99}
                step={0.01}
                onChange={(v) => setDedupThreshold(Math.round(v * 100) / 100)}
                disabled={isRunning}
                hint="Lower = more aggressive merging of paraphrases."
                fixed={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!file || submitting || isRunning}
            className="min-w-44"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting...
              </>
            ) : isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate deck
              </>
            )}
          </Button>
        </div>

        {jobId && (
          <Card className="mt-10">
            <CardHeader>
              <CardTitle className="font-display">Pipeline</CardTitle>
              <CardDescription>
                Each step runs locally on your machine. No data leaves the box.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineProgress
                status={status}
                events={events}
                error={detail?.error}
              />
            </CardContent>
          </Card>
        )}

        {jobId && (events.some((e) => e.outputs > 0 && e.stage === "generating_cards") || detail) && (
          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display">Cards</CardTitle>
                <CardDescription>
                  Click any card to see the source fact and difficulty rationale.
                </CardDescription>
              </div>
              {isFinished && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={`/decks/${jobId}` as any}>
                      <Library className="h-4 w-4" /> Open in library
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onStartStudying}
                    title="Open the in-browser study mode"
                  >
                    <GraduationCap className="h-4 w-4" /> Study now
                  </Button>
                  <Button asChild>
                    <a href={apkgUrl(jobId)} download>
                      <Download className="h-4 w-4" /> Download .apkg
                    </a>
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <CardPreviewList cards={detail?.cards || []} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ScalarSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fixed?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
}

function ScalarSlider({
  label,
  value,
  min,
  max,
  step,
  fixed,
  onChange,
  disabled,
  hint,
}: ScalarSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">
          {fixed != null ? value.toFixed(fixed) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
