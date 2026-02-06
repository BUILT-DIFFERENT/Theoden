import { useEffect, useState } from "react";

import { isTauri } from "@/app/utils/tauri";

export interface ThreadMetadata {
  worktreePath?: string;
  branch?: string;
}

const STORAGE_KEY = "theoden.thread.metadata";
const metadataCache = new Map<string, ThreadMetadata>();
const listeners = new Map<string, Set<() => void>>();
let hasLoaded = false;

function loadFromStorage() {
  if (hasLoaded) return;
  hasLoaded = true;
  if (typeof window === "undefined") return;
  if (!isTauri()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, ThreadMetadata>;
    Object.entries(parsed).forEach(([threadId, value]) => {
      if (value && typeof value === "object") {
        metadataCache.set(threadId, value);
      }
    });
  } catch (error) {
    console.warn("Failed to load thread metadata", error);
  }
}

function persistToStorage() {
  if (typeof window === "undefined") return;
  if (!isTauri()) return;
  try {
    const payload: Record<string, ThreadMetadata> = {};
    metadataCache.forEach((value, key) => {
      payload[key] = value;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist thread metadata", error);
  }
}

function emit(threadId: string) {
  const entry = listeners.get(threadId);
  if (!entry) return;
  entry.forEach((listener) => listener());
}

export function getThreadMetadata(threadId?: string): ThreadMetadata {
  if (!threadId) return {};
  loadFromStorage();
  return metadataCache.get(threadId) ?? {};
}

export function setThreadMetadata(
  threadId: string,
  update: Partial<ThreadMetadata>,
) {
  loadFromStorage();
  const current = metadataCache.get(threadId) ?? {};
  const next = { ...current, ...update };
  metadataCache.set(threadId, next);
  persistToStorage();
  emit(threadId);
}

export function subscribeThreadMetadata(
  threadId: string,
  listener: () => void,
) {
  const entry = listeners.get(threadId) ?? new Set();
  entry.add(listener);
  listeners.set(threadId, entry);
  return () => {
    const set = listeners.get(threadId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(threadId);
    }
  };
}

export function useThreadMetadata(threadId?: string) {
  const [metadata, setMetadataState] = useState<ThreadMetadata>(() =>
    getThreadMetadata(threadId),
  );

  useEffect(() => {
    if (!threadId) {
      setMetadataState({});
      return;
    }
    setMetadataState(getThreadMetadata(threadId));
    return subscribeThreadMetadata(threadId, () => {
      setMetadataState(getThreadMetadata(threadId));
    });
  }, [threadId]);

  const setMetadata = (update: Partial<ThreadMetadata>) => {
    if (!threadId) return;
    setThreadMetadata(threadId, update);
  };

  return { metadata, setMetadata };
}
