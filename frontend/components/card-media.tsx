"use client";
import { useMemo } from "react";
import { ImageIcon, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCardMedia } from "@/lib/media-store";
import { useStorageVersion } from "@/lib/hooks";
import { DrawingPreview } from "@/components/drawing-pad";
import { cn } from "@/lib/utils";

interface CardMediaViewProps {
  deckId: string;
  cardId: string;
  className?: string;
  size?: "sm" | "lg";
}

export function CardMediaView({ deckId, cardId, className, size = "lg" }: CardMediaViewProps) {
  const version = useStorageVersion();
  const media = useMemo(() => getCardMedia(deckId, cardId), [deckId, cardId, version]);
  const isEmpty =
    !media.image_url && !media.audio_data && !media.drawing_svg;
  if (isEmpty) return null;
  const small = size === "sm";
  return (
    <div className={cn("space-y-2", className)}>
      {media.image_url && (
        <figure className="overflow-hidden rounded-md border">
          <img
            src={media.image_url}
            alt={media.image_caption || "Card image"}
            className={cn(
              "w-full object-contain",
              small ? "max-h-32" : "max-h-72",
            )}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
          {media.image_caption && (
            <figcaption className="bg-secondary/40 px-2 py-1 text-[10px] text-muted-foreground">
              {media.image_caption}
            </figcaption>
          )}
        </figure>
      )}
      {media.drawing_svg && (
        <div className="space-y-1">
          {!small && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <ImageIcon className="h-3 w-3" /> Sketch
            </Badge>
          )}
          <DrawingPreview svg={media.drawing_svg} />
        </div>
      )}
      {media.audio_data && (
        <div className="flex items-center gap-2 rounded-md border bg-secondary/40 p-2">
          <Music className="h-4 w-4 text-primary" />
          <audio
            controls
            src={`data:${media.audio_mime || "audio/webm"};base64,${media.audio_data}`}
            className="h-8 flex-1"
          />
        </div>
      )}
    </div>
  );
}
