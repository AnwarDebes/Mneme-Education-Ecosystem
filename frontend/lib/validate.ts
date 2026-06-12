// Lightweight runtime validators for the backend response shapes the
// frontend depends on. We do not pull in zod because the surface area
// is small and dependency weight matters for a local-first app.
//
// Each validator throws ResponseShapeError with a path-anchored message
// if the payload deviates, so the user sees a meaningful boundary error
// rather than a vague `Cannot read properties of undefined` deep inside
// a component.

export class ResponseShapeError extends Error {
  readonly path: string;
  constructor(path: string, expected: string, got: unknown) {
    super(`API response shape mismatch at ${path}: expected ${expected}, got ${describe(got)}`);
    this.path = path;
    this.name = "ResponseShapeError";
  }
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array[len=${v.length}]`;
  return typeof v;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

interface Ctx {
  path: string;
}

function req<T>(v: unknown, ctx: Ctx, check: (x: unknown) => x is T, expected: string): T {
  if (!check(v)) throw new ResponseShapeError(ctx.path, expected, v);
  return v;
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

export function validateJobSummary(raw: unknown, path = "job"): {
  id: string;
  filename: string;
  status: string;
  n_cards: number;
  created_at: string;
} {
  if (!isObject(raw)) throw new ResponseShapeError(path, "object", raw);
  return {
    id: req(raw.id, { path: `${path}.id` }, isString, "string"),
    filename: req(raw.filename, { path: `${path}.filename` }, isString, "string"),
    status: req(raw.status, { path: `${path}.status` }, isString, "string"),
    n_cards: req(raw.n_cards, { path: `${path}.n_cards` }, isNumber, "number"),
    created_at: req(raw.created_at, { path: `${path}.created_at` }, isString, "string"),
  };
}

export function validateCard(raw: unknown, path: string): {
  id: string;
  question: string;
  answer: string;
} {
  if (!isObject(raw)) throw new ResponseShapeError(path, "object", raw);
  return {
    id: req(raw.id, { path: `${path}.id` }, isString, "string"),
    question: req(raw.question, { path: `${path}.question` }, isString, "string"),
    answer: req(raw.answer, { path: `${path}.answer` }, isString, "string"),
  };
}

export function validateVisionCheck(raw: unknown): {
  available: boolean;
  model: string | null;
  candidates?: string[];
  error?: string;
} {
  if (!isObject(raw)) throw new ResponseShapeError("visionCheck", "object", raw);
  const model = raw.model;
  if (model !== null && typeof model !== "string") {
    throw new ResponseShapeError("visionCheck.model", "string | null", model);
  }
  return {
    available: req(raw.available, { path: "visionCheck.available" }, isBoolean, "boolean"),
    model: model as string | null,
    candidates: Array.isArray(raw.candidates) ? raw.candidates.filter(isString) : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
  };
}
