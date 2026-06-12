"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Link2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { encodeSignedShare, type ParsedCard } from "@/lib/import";
import { signShare } from "@/lib/deck-signature";
import { toast } from "sonner";

interface ShareDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckName: string;
  cards: ParsedCard[];
}

export function ShareDeckDialog({ open, onOpenChange, deckName, cards }: ShareDeckDialogProps) {
  const [url, setUrl] = useState("");
  const [digest, setDigest] = useState("");
  const [copied, setCopied] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);

  useEffect(() => {
    if (!open) return;
    const trimmed: ParsedCard[] = cards.map((c) => ({
      question: c.question,
      answer: c.answer,
      tags: includeNotes ? c.tags : undefined,
      difficulty: includeNotes ? c.difficulty : undefined,
      source_fact: includeNotes ? c.source_fact : undefined,
    }));
    (async () => {
      const signed = await signShare(deckName, trimmed);
      const blob = encodeSignedShare(signed);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setUrl(`${origin}/import#deck=${blob}`);
      setDigest(signed.digest);
    })();
  }, [open, deckName, cards, includeNotes]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Share URL copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const sizeKb = (url.length / 1024).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Share this deck
          </DialogTitle>
          <DialogDescription>
            Cards are encoded into the URL fragment. No server, no account.
            Anyone with the link can import the deck.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-2 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Include tags + source facts</p>
              <p className="text-xs text-muted-foreground">Slightly larger URL.</p>
            </div>
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">URL</p>
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{cards.length} cards</span>
              {digest && (
                <span className="flex items-center gap-1 font-mono">
                  <ShieldCheck className="h-3 w-3 text-success" />
                  sha256-{digest.slice(0, 10)}...
                </span>
              )}
              <Badge variant="outline" className="text-[10px]">
                {sizeKb} KB
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
