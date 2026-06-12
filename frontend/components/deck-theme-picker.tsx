"use client";
import { useState } from "react";
import { Palette, RotateCcw } from "lucide-react";
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
import {
  clearDeckTheme,
  getDeckTheme,
  getThemePalette,
  setDeckTheme,
} from "@/lib/deck-theme";
import { useStorageVersion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeckThemePickerProps {
  deckId: string;
}

export function DeckThemePicker({ deckId }: DeckThemePickerProps) {
  const version = useStorageVersion();
  const palette = getThemePalette();
  const current = getDeckTheme(deckId);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Palette className="h-4 w-4" /> Theme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Deck theme
          </DialogTitle>
          <DialogDescription>
            Override the accent color on this deck's pages. Affects buttons,
            badges, and progress bars - not the global theme.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" key={`v-${version}`}>
          {palette.map((t, i) => {
            const active =
              !!current && current.primary_hue === t.primary_hue && current.primary_sat === t.primary_sat;
            return (
              <button
                key={i}
                onClick={() => {
                  setDeckTheme(deckId, t);
                  toast.success("Theme applied");
                }}
                className={cn(
                  "aspect-square rounded-lg ring-2 transition-all",
                  active ? "ring-foreground" : "ring-transparent hover:ring-border",
                )}
                style={{ background: `hsl(${t.primary_hue} ${t.primary_sat}% 50%)` }}
                title={`hue ${t.primary_hue}`}
              />
            );
          })}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              clearDeckTheme(deckId);
              toast.success("Theme reset");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
