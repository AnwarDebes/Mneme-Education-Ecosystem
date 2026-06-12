// Tiny Web Audio sound generator. Plays short blips on grade/correct/wrong
// events. Honors a localStorage mute toggle. No assets shipped.

import { readJSON, writeJSON, notifyStorageChange } from "./storage";

const KEY = "settings:sound";

export function isMuted(): boolean {
  return readJSON<boolean>(KEY, false);
}

export function setMuted(muted: boolean): void {
  writeJSON(KEY, muted);
  notifyStorageChange();
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

interface Tone {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function play(tones: Tone[]): void {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  try {
    let t = audio.currentTime;
    for (const tone of tones) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + tone.duration + 0.02);
      t += tone.duration;
    }
  } catch {
    /* ignore */
  }
}

export const Sounds = {
  correct: () => play([{ freq: 660, duration: 0.08 }, { freq: 880, duration: 0.12 }]),
  wrong: () => play([{ freq: 220, duration: 0.16, type: "triangle" }]),
  click: () => play([{ freq: 540, duration: 0.04, gain: 0.06 }]),
  complete: () =>
    play([
      { freq: 523, duration: 0.1 },
      { freq: 659, duration: 0.1 },
      { freq: 784, duration: 0.16 },
    ]),
};
