// TypeScript mirror of the backend's Pydantic models in
// src/mneme/server/models.py. Kept hand-written so the frontend has
// no runtime dependency on an OpenAPI generator. When the backend
// schema changes, update this file in lockstep.

export type JobStatus =
  | "pending"
  | "loading"
  | "chunking"
  | "extracting_facts"
  | "generating_cards"
  | "filtering"
  | "deduplicating"
  | "scoring_difficulty"
  | "writing_deck"
  | "done"
  | "error";

export interface StageEvent {
  stage: JobStatus;
  message: string;
  inputs: number;
  outputs: number;
  elapsed_seconds: number;
  timestamp: string;
}

export interface Card {
  id: string;
  question: string;
  answer: string;
  source_fact: string | null;
  tags: string[];
  difficulty: "easy" | "medium" | "hard" | null;
  difficulty_rationale: string | null;
  quality_score: number | null;
}

export interface JobConfig {
  model: string;
  base_url: string;
  deck_name: string | null;
  max_facts_per_chunk: number;
  max_cards_per_fact: number;
  dedup_threshold: number;
  difficulty_backend: "heuristic" | "tsetlin" | "none";
  seed: number | null;
}

export interface JobSummary {
  id: string;
  filename: string;
  status: JobStatus;
  created_at: string;
  finished_at: string | null;
  config: JobConfig;
  n_chunks: number;
  n_facts: number;
  n_cards: number;
  error: string | null;
}

export interface JobDetail extends JobSummary {
  cards: Card[];
  events: StageEvent[];
  apkg_path: string | null;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  ollama_reachable: boolean;
  ollama_models: string[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  system_append?: string;
}

export type ImproveMode = "clarify" | "simplify" | "variation" | "harder";

export interface ImproveCardRequest {
  question: string;
  answer: string;
  mode: ImproveMode;
  model?: string;
}

export interface ImproveCardResponse {
  question: string;
  answer: string;
  model: string;
  elapsed_seconds: number;
}

export interface SummarizeResponse {
  summary: string;
  model: string;
  elapsed_seconds: number;
}

export interface ExplainRequest {
  question: string;
  answer: string;
  user_attempt?: string;
  source_fact?: string;
  model?: string;
}

export interface ExplainResponse {
  explanation: string;
  model: string;
  elapsed_seconds: number;
}

export interface SuggestedCard {
  question: string;
  answer: string;
  rationale?: string | null;
}

export interface SuggestCardsResponse {
  suggestions: SuggestedCard[];
  model: string;
  elapsed_seconds: number;
}

export interface TextToCardsResponse {
  cards: SuggestedCard[];
  model: string;
  elapsed_seconds: number;
}

export interface SuggestTagsResponse {
  tags: string[];
  model: string;
  elapsed_seconds: number;
}

export interface SourceViewerResponse {
  filename: string;
  kind: "text" | "binary" | "missing";
  bytes: number;
  truncated: boolean;
  content: string;
}

export interface TranslatedCard {
  original_id: string;
  question: string;
  answer: string;
}

export interface TranslateDeckResponse {
  cards: TranslatedCard[];
  target_language: string;
  model: string;
  elapsed_seconds: number;
}

export interface VisionResponse {
  content: string;
  model: string;
  elapsed_seconds: number;
}

export interface ChatResponse {
  role: "assistant";
  content: string;
  model: string;
  elapsed_seconds: number;
}

export const STAGE_ORDER: JobStatus[] = [
  "pending",
  "loading",
  "chunking",
  "extracting_facts",
  "generating_cards",
  "filtering",
  "deduplicating",
  "scoring_difficulty",
  "writing_deck",
  "done",
];

export const STAGE_LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  loading: "Loading source",
  chunking: "Splitting into chunks",
  extracting_facts: "Extracting atomic facts",
  generating_cards: "Generating Q&A cards",
  filtering: "Quality filter",
  deduplicating: "Removing duplicates",
  scoring_difficulty: "Rating difficulty",
  writing_deck: "Writing Anki deck",
  done: "Done",
  error: "Error",
};
