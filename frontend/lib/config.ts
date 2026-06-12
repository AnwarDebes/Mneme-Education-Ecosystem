// Single source of truth for environment-derived configuration. Anything
// that reaches for process.env elsewhere is a smell: it makes test setup
// painful and silently splinters defaults. Keep new env reads here.

export const API_BASE: string =
  (process.env.NEXT_PUBLIC_API_BASE?.trim().replace(/\/$/, "") || "http://localhost:8000");

export const IS_PRODUCTION: boolean = process.env.NODE_ENV === "production";

// Optional override for the default Ollama endpoint that the backend will
// see if the request body doesn't already supply one. Currently unused on
// the frontend, exported for parity if the chat dialogs ever need it.
export const OLLAMA_BASE_URL: string =
  process.env.NEXT_PUBLIC_OLLAMA_BASE_URL?.trim().replace(/\/$/, "") || "http://localhost:11434";
