"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak, speechAvailable, stopSpeaking } from "@/lib/speech";

interface SpeakButtonProps {
  text: string;
  className?: string;
  size?: "sm" | "default" | "icon" | "lg";
  rate?: number;
  hidden?: boolean;
}

export function SpeakButton({ text, className, size = "icon", rate = 1, hidden }: SpeakButtonProps) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => setAvailable(speechAvailable()), []);
  useEffect(() => () => stopSpeaking(), []);

  if (!available || hidden) return null;

  const toggle = () => {
    if (active) {
      stopSpeaking();
      setActive(false);
      return;
    }
    speak(text, { rate });
    setActive(true);
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setActive(false);
    u.onerror = () => setActive(false);
    setTimeout(() => setActive(false), Math.max(2000, text.length * 80));
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      title={active ? "Stop reading" : "Read aloud"}
      className={className}
    >
      {active ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </Button>
  );
}
