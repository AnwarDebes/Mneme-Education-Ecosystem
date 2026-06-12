"use client";
// Thin wrapper around the Web Speech API (SpeechSynthesis). Falls back
// gracefully if the browser doesn't support it.

import { useEffect, useState } from "react";

export function speechAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function useSpeechVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!speechAvailable()) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

export function speak(text: string, options?: { rate?: number; pitch?: number; voice?: SpeechSynthesisVoice | null; lang?: string }): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (options?.rate != null) u.rate = options.rate;
    if (options?.pitch != null) u.pitch = options.pitch;
    if (options?.voice) u.voice = options.voice;
    if (options?.lang) u.lang = options.lang;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
