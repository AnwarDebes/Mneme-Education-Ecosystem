"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cardsFromText, visionAsk, visionCheck, type VisionCheck } from "@/lib/api";
import { postImport } from "@/lib/import";
import { toastActionFailed } from "@/lib/toast-helpers";
import { toast } from "sonner";

// Drop an image, the local vision model reads it (OCR + description),
// then quick-cards-from-text pipes the result into flashcards.
export function VisionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [b64, setB64] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [preflight, setPreflight] = useState<VisionCheck | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("mneme:open-vision", onOpen);
    return () => window.removeEventListener("mneme:open-vision", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    visionCheck()
      .then(setPreflight)
      .catch((err) => setPreflight({ available: false, model: null, error: String(err?.message ?? err) }));
  }, [open]);

  const onPick = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      const comma = data.indexOf(",");
      setB64(comma >= 0 ? data.slice(comma + 1) : data);
    };
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!b64) {
      toast.error("Pick an image first");
      return;
    }
    setPending(true);
    try {
      const resp = await visionAsk({
        image_base64: b64,
        prompt: "Transcribe all text from this image verbatim, then list any diagrams or figures.",
      });
      setText(resp.content);
      toast.success(`Vision model: ${resp.model}`);
    } catch (err: any) {
      toastActionFailed("extract text from image", err);
    } finally {
      setPending(false);
    }
  };

  const makeCards = async () => {
    if (!text.trim()) {
      toast.error("Extract text first");
      return;
    }
    setPending(true);
    try {
      const r = await cardsFromText({ text, max_cards: 8 });
      const job = await postImport(filename.replace(/\.\w+$/, "") || "image deck", r.cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        tags: ["from-image"],
      })));
      toast.success(`Imported ${job.n_cards} cards`);
      router.push(`/decks/${job.id}` as any);
      setOpen(false);
    } catch (err: any) {
      toastActionFailed("turn this text into cards", err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Camera className="h-4 w-4" /> Image -&gt; cards
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Image to cards
          </DialogTitle>
          <DialogDescription>
            Local Ollama vision model reads the image (OCR + description),
            then turns the text into flashcards as a new deck. Needs a vision
            model pulled (llava, moondream, minicpm-v, ...).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {preflight && !preflight.available && (
            <div className="rounded-md border border-warn/40 bg-warn/5 p-3 text-sm">
              <p className="font-medium text-warn">No vision model installed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pull one locally before using this. Try:
                <code className="ml-1 rounded bg-muted px-1.5 py-0.5">ollama pull llava</code>
                {preflight.error && (
                  <span className="ml-1 block">Probe error: {preflight.error}</span>
                )}
              </p>
            </div>
          )}
          {preflight?.available && (
            <div className="rounded-md border border-success/30 bg-success/5 p-2 text-xs text-success">
              Ready - using <code className="rounded bg-muted px-1.5 py-0.5">{preflight.model}</code>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/40 p-6 text-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            {filename ? (
              <p className="mt-2 text-sm font-medium">{filename}</p>
            ) : (
              <p className="mt-2 text-sm">Drop or pick an image (PNG/JPG)</p>
            )}
            {b64 && (
              <img
                src={`data:image/png;base64,${b64}`}
                alt="preview"
                className="mt-3 max-h-32 rounded"
              />
            )}
          </label>
          <Button onClick={extract} disabled={!b64 || pending || !preflight?.available} variant="outline" className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Extract text via vision model
          </Button>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Extracted text will appear here, or paste your own."
          />
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={makeCards} disabled={!text.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Make cards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
