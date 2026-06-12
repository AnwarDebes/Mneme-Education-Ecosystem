"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runSnippet, type RunResult } from "@/lib/code-runner";

interface CodeSandboxProps {
  code: string;
  className?: string;
}

export function CodeSandbox({ code, className }: CodeSandboxProps) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    const r = runSnippet(code);
    setResult(r);
    setRunning(false);
  };

  return (
    <div className={className}>
      <pre className="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs ring-1 ring-border">
        <code>{code}</code>
      </pre>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run
        </Button>
        {result && (
          <Badge variant="outline" className="text-[10px]">
            {result.elapsed_ms}ms
          </Badge>
        )}
        {result && !result.ok && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            error
          </Badge>
        )}
      </div>
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 rounded-md border bg-card p-3 text-xs"
        >
          {result.logs.length > 0 && (
            <pre className="whitespace-pre-wrap font-mono text-muted-foreground">{result.logs.join("\n")}</pre>
          )}
          {result.ok && result.value !== undefined && (
            <p className="mt-1 font-mono">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">return =&gt; </span>
              {typeof result.value === "string" ? `"${result.value}"` : JSON.stringify(result.value)}
            </p>
          )}
          {!result.ok && result.error && (
            <p className="font-mono text-destructive">{result.error}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
