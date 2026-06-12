"use client";
// Tiny wrapper around the Web Speech Recognition API (Chrome + Edge).
// Returns a hook with start/stop helpers and live transcript state.

import { useEffect, useRef, useState } from "react";

type Recognition = any;

export function speechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
}

export type SpeechError = "permission" | "no-speech" | "audio" | "network" | "other";

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(speechRecognitionAvailable());
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = (opts?: { lang?: string }) => {
    if (!speechRecognitionAvailable()) return;
    const Ctor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts?.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
    setTranscript("");
    setInterim("");
    setError(null);
    rec.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((cur) => (cur + " " + finalText).trim());
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = (event: any) => {
      setListening(false);
      setInterim("");
      const code = String(event?.error ?? "");
      if (code === "not-allowed" || code === "service-not-allowed") setError("permission");
      else if (code === "no-speech") setError("no-speech");
      else if (code === "audio-capture") setError("audio");
      else if (code === "network") setError("network");
      else setError("other");
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
      setError("other");
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  return { supported, listening, transcript, interim, error, start, stop, setTranscript };
}
