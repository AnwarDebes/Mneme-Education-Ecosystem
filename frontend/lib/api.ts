// REST + SSE client for the mneme backend.
//
// Single ``apiBase()`` source of truth so the frontend can be repointed
// at a different backend without hunting for hardcoded URLs.

import type {
  Card,
  ChatMessage,
  ChatResponse,
  ExplainResponse,
  HealthResponse,
  ImproveCardResponse,
  ImproveMode,
  SourceViewerResponse,
  SuggestCardsResponse,
  SuggestTagsResponse,
  SummarizeResponse,
  TextToCardsResponse,
  TranslateDeckResponse,
  VisionResponse,
  JobConfig,
  JobDetail,
  JobSummary,
  StageEvent,
} from "./types";

import { API_BASE } from "./config";

export function apiBase(): string {
  return API_BASE;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* swallow parse errors */
    }
    throw new ApiError(detail, resp.status);
  }
  return (await resp.json()) as T;
}

export async function health(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export async function listJobs(): Promise<JobSummary[]> {
  return request<JobSummary[]>("/api/jobs");
}

export async function jobDetail(id: string): Promise<JobDetail> {
  return request<JobDetail>(`/api/jobs/${id}`);
}

export async function jobCards(id: string): Promise<Card[]> {
  return request<Card[]>(`/api/jobs/${id}/cards`);
}

export async function createJob(
  file: File,
  config: Partial<JobConfig>,
): Promise<JobSummary> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));
  return request<JobSummary>("/api/jobs", { method: "POST", body: form });
}

export async function createJobFromUrl(
  url: string,
  deckName?: string,
  config?: Partial<JobConfig>,
): Promise<JobSummary> {
  return request<JobSummary>("/api/jobs/from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      deck_name: deckName,
      config: config ?? null,
    }),
  });
}

export async function jobSource(
  jobId: string,
  maxChars = 200000,
): Promise<SourceViewerResponse> {
  return request<SourceViewerResponse>(
    `/api/jobs/${jobId}/source?max_chars=${maxChars}`,
  );
}

export async function translateDeck(
  jobId: string,
  body: { target_language: string; model?: string; new_deck_name?: string },
): Promise<TranslateDeckResponse> {
  return request<TranslateDeckResponse>(`/api/jobs/${jobId}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function visionAsk(body: {
  image_base64: string;
  prompt?: string;
  model?: string;
}): Promise<VisionResponse> {
  return request<VisionResponse>("/api/vision/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, base_url: "http://localhost:11434" }),
  });
}

export interface VisionCheck {
  available: boolean;
  model: string | null;
  candidates?: string[];
  error?: string;
}

export async function visionCheck(): Promise<VisionCheck> {
  const raw = await request<unknown>("/api/vision/check");
  // Validate at the boundary so any backend drift surfaces here rather
  // than at the consuming component's deep property access.
  const { validateVisionCheck } = await import("./validate");
  return validateVisionCheck(raw);
}

export async function deleteJob(jobId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/jobs/${jobId}`, { method: "DELETE" });
}

export async function gradeCard(jobId: string, cardId: string, grade: string) {
  return request<{ status: string }>(`/api/jobs/${jobId}/study/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade, card_id: cardId }),
  });
}

export function apkgUrl(jobId: string): string {
  return `${apiBase()}/api/jobs/${jobId}/apkg`;
}

export async function chatWithDeck(
  jobId: string,
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; system_append?: string },
): Promise<ChatResponse> {
  return request<ChatResponse>(`/api/jobs/${jobId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      system_append: options?.system_append,
    }),
  });
}

export async function improveCard(
  jobId: string,
  body: { question: string; answer: string; mode: ImproveMode; model?: string },
): Promise<ImproveCardResponse> {
  return request<ImproveCardResponse>(`/api/jobs/${jobId}/cards/improve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function summarizeDeck(
  jobId: string,
  options?: { model?: string; style?: "bullets" | "paragraph" },
): Promise<SummarizeResponse> {
  return request<SummarizeResponse>(`/api/jobs/${jobId}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: options?.model, style: options?.style ?? "bullets" }),
  });
}

export async function explainCard(
  jobId: string,
  body: {
    question: string;
    answer: string;
    user_attempt?: string;
    source_fact?: string;
    model?: string;
  },
): Promise<ExplainResponse> {
  return request<ExplainResponse>(`/api/jobs/${jobId}/cards/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function suggestCards(
  jobId: string,
  body: { count?: number; model?: string },
): Promise<SuggestCardsResponse> {
  return request<SuggestCardsResponse>(`/api/jobs/${jobId}/cards/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function cardsFromText(body: {
  text: string;
  max_cards?: number;
  model?: string;
}): Promise<TextToCardsResponse> {
  return request<TextToCardsResponse>("/api/cards/from-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, base_url: "http://localhost:11434" }),
  });
}

export async function suggestTagsForCard(
  jobId: string,
  body: {
    question: string;
    answer: string;
    existing_tags?: string[];
    model?: string;
  },
): Promise<SuggestTagsResponse> {
  return request<SuggestTagsResponse>(`/api/jobs/${jobId}/cards/suggest-tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Open an EventSource to the job's progress stream. The caller is
 * responsible for closing it when the page unmounts.
 */
export function openJobStream(
  jobId: string,
  handlers: {
    onStage?: (event: StageEvent) => void;
    onEnd?: (info: { status: string; n_cards: number }) => void;
    onError?: (err: Event) => void;
  },
): EventSource {
  const es = new EventSource(`${apiBase()}/api/jobs/${jobId}/events`);
  es.addEventListener("stage", (msg) => {
    try {
      const data = JSON.parse((msg as MessageEvent).data) as StageEvent;
      handlers.onStage?.(data);
    } catch {
      /* ignore parse errors */
    }
  });
  es.addEventListener("end", (msg) => {
    try {
      const data = JSON.parse((msg as MessageEvent).data) as {
        status: string;
        n_cards: number;
      };
      handlers.onEnd?.(data);
    } catch {
      /* ignore parse errors */
    }
    es.close();
  });
  es.addEventListener("error", (err) => {
    handlers.onError?.(err);
  });
  return es;
}
