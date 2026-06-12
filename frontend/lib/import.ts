// CSV/TSV/JSON parsers + share-URL encoding for deck import/export.

import { apiBase } from "./api";
import type { JobSummary } from "./types";

export interface ParsedCard {
  question: string;
  answer: string;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  source_fact?: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  errors: string[];
}

// --------------------------------------------------------------------------
// CSV / TSV
// --------------------------------------------------------------------------

// Stream-tokenize a full CSV/TSV body. Handles:
//   - UTF-8 BOM at start of file
//   - quoted fields containing the delimiter
//   - newlines inside quoted fields
//   - escaped double quotes (`""` -> `"`)
//   - both `\r\n` and `\n` line endings
function tokenizeCSV(text: string, delim: string): string[][] {
  // Strip UTF-8 BOM (﻿) if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      // Treat \r\n as a single terminator.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      // Skip empty rows (blank lines between records).
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  // Flush the final partial row.
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  }
  return rows;
}

export function parseDelimited(text: string, delim: "," | "\t"): ParseResult {
  const cards: ParsedCard[] = [];
  const errors: string[] = [];
  const rows = tokenizeCSV(text, delim);
  if (rows.length === 0) return { cards, errors: ["empty file"] };

  // Detect header row: if the first row looks like "question,answer" treat it as a header.
  const first = rows[0].map((s) => s.trim().toLowerCase());
  const headerOffset = first[0] === "question" || first[0] === "q" || first[0] === "front" ? 1 : 0;

  for (let i = headerOffset; i < rows.length; i++) {
    const parts = rows[i];
    if (parts.length < 2) {
      errors.push(`row ${i + 1}: needs at least 2 columns (question, answer)`);
      continue;
    }
    const question = parts[0]?.trim();
    const answer = parts[1]?.trim();
    if (!question || !answer) {
      errors.push(`row ${i + 1}: empty question or answer`);
      continue;
    }
    const tagsRaw = parts[2]?.trim();
    const tags = tagsRaw
      ? tagsRaw.split(/[|,;]/).map((t) => t.trim()).filter(Boolean)
      : undefined;
    const difficulty = (parts[3]?.trim().toLowerCase() as ParsedCard["difficulty"]) || undefined;
    const source_fact = parts[4]?.trim() || undefined;
    cards.push({ question, answer, tags, difficulty, source_fact });
  }
  return { cards, errors };
}

export function parseJSON(text: string): ParseResult {
  const errors: string[] = [];
  try {
    const raw = JSON.parse(text);
    const arr = Array.isArray(raw) ? raw : raw.cards;
    if (!Array.isArray(arr)) {
      return { cards: [], errors: ["expected an array, or an object with a 'cards' array"] };
    }
    const cards: ParsedCard[] = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const q = item.question || item.q || item.front;
      const a = item.answer || item.a || item.back;
      if (typeof q !== "string" || typeof a !== "string" || !q.trim() || !a.trim()) {
        errors.push(`item ${i + 1}: missing question/answer`);
        continue;
      }
      cards.push({
        question: q.trim(),
        answer: a.trim(),
        tags: Array.isArray(item.tags) ? item.tags : undefined,
        difficulty: item.difficulty,
        source_fact: item.source_fact || item.fact || undefined,
      });
    }
    return { cards, errors };
  } catch (err) {
    return { cards: [], errors: [`not valid JSON: ${(err as Error).message}`] };
  }
}

// --------------------------------------------------------------------------
// Share URL encoding
// --------------------------------------------------------------------------

// We can't ship a heavy compressor; base64 is good enough for ~100 card decks
// (~10 KB). For bigger decks we just truncate gracefully.

function encodeBase64Url(s: string): string {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(s: string): string {
  if (typeof window === "undefined") return "";
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShare(name: string, cards: ParsedCard[]): string {
  const payload = { name, cards };
  const json = JSON.stringify(payload);
  return encodeBase64Url(json);
}

export function encodeSignedShare(payload: {
  name: string;
  cards: ParsedCard[];
  digest: string;
  version: string;
  created_at: string;
}): string {
  return encodeBase64Url(JSON.stringify(payload));
}

export interface DecodedShare {
  name: string;
  cards: ParsedCard[];
  digest?: string;
  version?: string;
  created_at?: string;
}

export function decodeShare(blob: string): DecodedShare | null {
  try {
    const json = decodeBase64Url(blob);
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.cards)) return null;
    return {
      name: String(parsed.name || "Shared deck"),
      cards: parsed.cards,
      digest: parsed.digest,
      version: parsed.version,
      created_at: parsed.created_at,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Push to backend
// --------------------------------------------------------------------------

export async function postImport(filename: string, cards: ParsedCard[]): Promise<JobSummary> {
  const resp = await fetch(`${apiBase()}/api/jobs/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, cards }),
  });
  if (!resp.ok) {
    let msg = `${resp.status} ${resp.statusText}`;
    try {
      const j = await resp.json();
      if (j?.detail) msg = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await resp.json()) as JobSummary;
}

export async function postImportApkg(file: File): Promise<JobSummary> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${apiBase()}/api/jobs/import-apkg`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    let msg = `${resp.status} ${resp.statusText}`;
    try {
      const j = await resp.json();
      if (j?.detail) msg = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await resp.json()) as JobSummary;
}
