"use client";

/**
 * Tiny localStorage-backed store for per-job status ("opened" / "applied"),
 * consumed with React's useSyncExternalStore.
 */
export type Status = "opened" | "applied";
export type StatusMap = Record<string, Status>;

const KEY = "job-radar-status-v1";
const EMPTY: StatusMap = {};
const listeners = new Set<() => void>();
let cache: StatusMap | null = null;

function read(): StatusMap {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as StatusMap;
  } catch {
    cache = {};
  }
  return cache;
}

export const statusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: read,
  getServerSnapshot: () => EMPTY,
  set(id: string, status: Status | null) {
    const next = { ...read() };
    if (status) next[id] = status;
    else delete next[id];
    cache = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  },
};
