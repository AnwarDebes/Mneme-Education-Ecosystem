"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMuted, setMuted } from "@/lib/sound";
import { useStorageVersion } from "@/lib/hooks";

export function SoundToggle() {
  const version = useStorageVersion();
  const [muted, setMutedLocal] = useState(false);
  useEffect(() => {
    setMutedLocal(isMuted());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedLocal(next);
      }}
      title={muted ? "Unmute sound effects" : "Mute sound effects"}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </Button>
  );
}
