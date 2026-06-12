"use client";
import { useEffect, useState } from "react";
import { loadStats, type GlobalStats, emptyStats } from "./stats";
import { subscribe, subscribeNamespace, type StorageNamespace } from "./storage";

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useStats(): GlobalStats {
  const [stats, setStats] = useState<GlobalStats>(emptyStats());
  useEffect(() => {
    setStats(loadStats());
    return subscribe(() => setStats(loadStats()));
  }, []);
  return stats;
}

export function useStorageVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => subscribe(() => setV((x) => x + 1)), []);
  return v;
}

// Subscribe to changes for one namespace only. Components that care about
// schedule changes (the library page, the deck-detail stats card) should
// use this instead of useStorageVersion so confidence + variant writes
// don't trigger a re-render.
export function useNamespaceVersion(ns: StorageNamespace): number {
  const [v, setV] = useState(0);
  useEffect(() => subscribeNamespace(ns, () => setV((x) => x + 1)), [ns]);
  return v;
}
