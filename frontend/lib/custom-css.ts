// User-defined CSS overrides. Live-applied via a <style> tag injected by
// AppBoot. Capped at 10KB to avoid abuse.

import { readJSON, writeJSON, notifyStorageChange, subscribe } from "./storage";
import { useEffect, useState } from "react";

const KEY = "settings:custom-css";
const MAX = 10000;

export function loadCustomCss(): string {
  return readJSON<string>(KEY, "");
}

export function saveCustomCss(css: string): void {
  const trimmed = css.slice(0, MAX);
  writeJSON(KEY, trimmed);
  applyCustomCss(trimmed);
  notifyStorageChange();
}

export function applyCustomCss(css: string): void {
  if (typeof document === "undefined") return;
  const id = "mneme-custom-css";
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css || "";
}

export function useCustomCss(): [string, (css: string) => void] {
  const [css, setCss] = useState("");
  useEffect(() => {
    setCss(loadCustomCss());
    return subscribe(() => setCss(loadCustomCss()));
  }, []);
  return [css, saveCustomCss];
}
