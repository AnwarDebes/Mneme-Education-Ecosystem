"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportDialog } from "@/components/import-dialog";
import { SampleDecksRow } from "@/components/sample-deck-card";
import { decodeShare, postImport } from "@/lib/import";
import { digestCards } from "@/lib/deck-signature";
import { toast } from "sonner";

export function ImportLanding() {
  const router = useRouter();
  const params = useSearchParams();
  const [autoImport, setAutoImport] = useState<{
    name: string;
    count: number;
    pending: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const blob = hash.startsWith("deck=") ? hash.slice("deck=".length) : hash;
    const decoded = decodeShare(blob);
    if (!decoded) {
      toast.error("That share fragment isn't a mneme deck");
      return;
    }
    setAutoImport({ name: decoded.name, count: decoded.cards.length, pending: false });
    (async () => {
      setAutoImport({ name: decoded.name, count: decoded.cards.length, pending: true });
      if (decoded.digest) {
        const computed = await digestCards(decoded.cards);
        if (computed !== decoded.digest) {
          toast.warning("Signature mismatch", {
            description: "Share URL may have been altered. Importing anyway.",
          });
        } else {
          toast.success("Signed share verified");
        }
      }
      try {
        const job = await postImport(decoded.name, decoded.cards);
        toast.success(`Imported ${job.n_cards} cards from share URL`);
        router.push(`/decks/${job.id}` as any);
      } catch (err: any) {
        setAutoImport({
          name: decoded.name,
          count: decoded.cards.length,
          pending: false,
          error: err?.message || String(err),
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container space-y-10 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Import</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Bring decks in</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Already have an Anki deck or a Quizlet export? Drop it in. Got a share
          URL from a friend? Paste it. New to mneme? Try a sample.
        </p>
      </header>

      {autoImport && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                {autoImport.pending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : autoImport.error ? (
                  <span className="text-destructive">!</span>
                ) : (
                  <Check className="h-5 w-5 text-success" />
                )}
                <div>
                  <p className="font-medium">{autoImport.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {autoImport.count} cards{" "}
                    {autoImport.pending
                      ? "(importing...)"
                      : autoImport.error
                      ? `(failed: ${autoImport.error})`
                      : "(imported)"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <section>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Pick a source
            </CardTitle>
            <CardDescription>
              .apkg, CSV/TSV, JSON, or paste a mneme share URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <ImportDialog />
              <Button variant="outline" onClick={() => router.push("/generator")}>
                Or generate from a source file
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <SampleDecksRow />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Supported formats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label=".apkg (Anki)" body="ZIP of the Anki SQLite collection. First two fields become Q and A. Tags carry over." />
          <Row label="CSV / TSV" body="One card per line. Columns: question, answer, tags (pipe- or comma-sep), difficulty, source_fact." />
          <Row label="JSON" body='Either an array of {question, answer, tags?, difficulty?, source_fact?} or {cards: [...]}.' />
          <Row label="Shared URL" body="A mneme #deck=... link. Paste the URL or open the link directly; this page auto-imports from the fragment." />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
