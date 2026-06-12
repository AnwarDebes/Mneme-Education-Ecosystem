"use client";
import { useState } from "react";
import { Image as ImageIcon, RotateCcw, X } from "lucide-react";
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
import { getBannerGradients, getDeckBanner, setDeckBanner } from "@/lib/deck-banner";
import { useStorageVersion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeckBannerPickerProps {
  deckId: string;
}

export function DeckBannerPicker({ deckId }: DeckBannerPickerProps) {
  const version = useStorageVersion();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const current = getDeckBanner(deckId);
  const gradients = getBannerGradients();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ImageIcon className="h-4 w-4" /> Banner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Deck banner
          </DialogTitle>
          <DialogDescription>
            Pick a gradient or paste an image URL. Shows on the deck header and
            library card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3" key={`v-${version}`}>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Gradients</p>
            <div className="grid grid-cols-3 gap-2">
              {gradients.map((g) => {
                const active = current?.kind === "gradient" && current.value === g.css;
                return (
                  <button
                    key={g.name}
                    onClick={() => {
                      setDeckBanner(deckId, { kind: "gradient", value: g.css });
                      toast.success(`Banner: ${g.name}`);
                    }}
                    className={cn(
                      "aspect-[3/1] rounded-md ring-2 transition-all",
                      active ? "ring-foreground" : "ring-transparent hover:ring-border",
                    )}
                    style={{ background: g.css }}
                    title={g.name}
                  />
                );
              })}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-url">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="banner-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://images.example.com/cover.jpg"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!url.startsWith("http")) {
                    toast.error("Paste a full http(s) URL");
                    return;
                  }
                  setDeckBanner(deckId, { kind: "url", value: url });
                  toast.success("Banner set");
                  setUrl("");
                }}
              >
                Set
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setDeckBanner(deckId, null);
              toast.success("Banner cleared");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Clear
          </Button>
          <Button onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeckBannerProps {
  deckId: string;
  className?: string;
}

export function DeckBanner({ deckId, className }: DeckBannerProps) {
  const version = useStorageVersion();
  const banner = getDeckBanner(deckId);
  if (!banner) return null;
  if (banner.kind === "url") {
    return (
      <div
        className={cn("h-32 w-full overflow-hidden rounded-xl bg-cover bg-center", className)}
        style={{ backgroundImage: `url(${banner.value})` }}
        key={`v-${version}`}
      />
    );
  }
  return (
    <div
      className={cn("h-32 w-full rounded-xl", className)}
      style={{ background: banner.value }}
      key={`v-${version}`}
    />
  );
}
