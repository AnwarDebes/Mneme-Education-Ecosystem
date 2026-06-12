"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Sparkles, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createJobFromUrl, health } from "@/lib/api";
import { toast } from "sonner";

export function UrlIngestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [deckName, setDeckName] = useState("");
  const [model, setModel] = useState<string | undefined>();
  const [models, setModels] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    health()
      .then((h) => {
        setModels(h.ollama_models || []);
        if (!model && h.ollama_models?.length) {
          const pref = h.ollama_models.find((m) => /qwen2\.5|llama3|gemma3/i.test(m));
          setModel(pref || h.ollama_models[0]);
        }
      })
      .catch(() => {});
  }, [open, model]);

  const submit = async () => {
    const u = url.trim();
    if (!u.startsWith("http")) {
      toast.error("Paste a full http(s) URL");
      return;
    }
    setPending(true);
    try {
      const job = await createJobFromUrl(u, deckName.trim() || undefined, model ? { model } : undefined);
      toast.success("Pipeline started", { description: `Job ${job.id}` });
      router.push(`/generator?job=${job.id}` as any);
      setOpen(false);
    } catch (err: any) {
      toast.error("Could not start", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Link2 className="h-4 w-4" /> From URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Generate from a URL
          </DialogTitle>
          <DialogDescription>
            Backend fetches the page (HTML / PDF / markdown), then runs the
            usual mneme pipeline on it. Local processing only; the URL is
            fetched server-side, no data goes anywhere else.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="u-url">URL</Label>
            <Input
              id="u-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/Photosynthesis"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-name">Deck name (optional)</Label>
            <Input
              id="u-name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Photosynthesis from Wikipedia"
            />
          </div>
          {models.length > 0 && (
            <div className="space-y-1">
              <Label>Model</Label>
              <Select value={model || ""} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Fetch + generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
