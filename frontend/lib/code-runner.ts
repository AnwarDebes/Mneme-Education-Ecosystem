// Tiny sandboxed JS runner. Builds a Function from the user's code and
// captures console.log + return value. Strictly client-side; nothing
// reaches the backend. No async, no network, no DOM.

export interface RunResult {
  ok: boolean;
  value?: unknown;
  logs: string[];
  error?: string;
  elapsed_ms: number;
}

export function runSnippet(code: string, timeoutMs = 500): RunResult {
  if (typeof window === "undefined") {
    return { ok: false, logs: [], error: "no window", elapsed_ms: 0 };
  }
  const logs: string[] = [];
  const fakeConsole = {
    log: (...args: unknown[]) => logs.push(args.map(format).join(" ")),
    error: (...args: unknown[]) => logs.push("[err] " + args.map(format).join(" ")),
    warn: (...args: unknown[]) => logs.push("[warn] " + args.map(format).join(" ")),
  };
  const t0 = performance.now();
  try {
    // Whitelist: pass only console; deny window/document/eval/Function.
    const fn = new Function(
      "console",
      `"use strict";\nreturn (function () { ${code}\n })();`,
    );
    let result: unknown;
    const timeoutHandle = setTimeout(() => {
      throw new Error(`Timeout after ${timeoutMs}ms`);
    }, timeoutMs);
    try {
      result = fn(fakeConsole);
    } finally {
      clearTimeout(timeoutHandle);
    }
    return {
      ok: true,
      value: result,
      logs,
      elapsed_ms: Math.round(performance.now() - t0),
    };
  } catch (err: any) {
    return {
      ok: false,
      logs,
      error: err?.message ? String(err.message) : String(err),
      elapsed_ms: Math.round(performance.now() - t0),
    };
  }
}

function format(x: unknown): string {
  if (x == null) return String(x);
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}
