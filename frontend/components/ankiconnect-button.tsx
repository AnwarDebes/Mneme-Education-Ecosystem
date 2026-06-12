"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CircleAlert, Loader2, Network, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadAnkiConnectUrl, pingAnki, pushDeck, saveAnkiConnectUrl } from "@/lib/ankiconnect";
import type { ResolvedCard } from "@/lib/cards";
import { toast } from "sonner";

interface AnkiConnectButtonProps {
  deckName: string;
  cards: ResolvedCard[];
}

export function AnkiConnectButton({ deckName, cards }: AnkiConnectButtonProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState(deckName);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [version, setVersion] = useState<number | null>(null);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrl(loadAnkiConnectUrl());
    setTarget(deckName);
    setStatus("idle");
    setVersion(null);
    setError(null);
    setResult(null);
  }, [open, deckName]);

  const check = async () => {
    setStatus("checking");
    setError(null);
    try {
      const r = await pingAnki(url);
      setVersion(r.version);
      setStatus("ok");
    } catch (err: any) {
      setStatus("fail");
      setError(err?.message ? String(err.message) : String(err));
    }
  };

  const push = async () => {
    saveAnkiConnectUrl(url);
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const r = await pushDeck(target.trim() || "mneme", cards);
      setResult({ added: r.added, duplicates: r.duplicates });
      if (r.errors.length > 0) {
        toast.warning(`${r.errors.length} cards had issues`, { description: r.errors[0] });
      } else {
        toast.success(`${r.added} cards pushed (${r.duplicates} duplicates skipped)`);
      }
    } catch (err: any) {
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Network className="h-4 w-4" /> Push to Anki
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" /> Push to running Anki
            </DialogTitle>
            <DialogDescription>
              Sends these cards into your local Anki desktop via the AnkiConnect
              plugin. Anki must be running with AnkiConnect installed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ac-url">AnkiConnect URL</Label>
              <div className="flex gap-2">
                <Input
                  id="ac-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8765"
                />
                <Button variant="outline" onClick={check} disabled={status === "checking"}>
                  {status === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {status === "ok" && version != null && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-success">
                  <Check className="inline h-3 w-3" /> Connected to AnkiConnect v{version}
                </motion.p>
              )}
              {status === "fail" && error && (
                <p className="text-xs text-destructive">
                  <CircleAlert className="inline h-3 w-3" /> {error}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ac-deck">Target deck name (will be created)</Label>
              <Input id="ac-deck" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            {result && (
              <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm text-success">
                <Sparkles className="inline h-4 w-4" /> Added {result.added} cards
                {result.duplicates > 0 && `, skipped ${result.duplicates} duplicates`}.
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <a
              href="https://foosoft.net/projects/anki-connect/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              Install AnkiConnect first?
            </a>
            <Button onClick={push} disabled={pushing || status !== "ok"}>
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Push {cards.length} cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
