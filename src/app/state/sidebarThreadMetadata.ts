import { useEffect, useState } from "react";

import {
  syncPersistedAtom,
  updatePersistedAtom,
} from "@/app/services/host/persistedState";
import { isTauri } from "@/app/utils/tauri";

const STORAGE_KEY = "codex.sidebar.thread.metadata";
const ATOM_KEY = "sidebar.thread.metadata";

export interface SidebarThreadMetadataEntry {
  pinned?: boolean;
  alias?: string;
}

export type SidebarThreadMetadataMap = Record<
  string,
  SidebarThreadMetadataEntry
>;

const metadataCache = new Map<string, SidebarThreadMetadataEntry>();
const listeners = new Set<() => void>();
let hasLoaded = false;

function normalizeAlias(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeEntry(value: unknown): SidebarThreadMetadataEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const pinned = record.pinned === true;
  const alias = normalizeAlias(record.alias);
  if (!pinned && !alias) {
    return null;
  }
  return {
    pinned: pinned || undefined,
    alias,
  };
}

function snapshotRecord(): SidebarThreadMetadataMap {
  const payload: SidebarThreadMetadataMap = {};
  metadataCache.forEach((value, threadId) => {
    payload[threadId] = { ...value };
  });
  return payload;
}

function normalizeRecord(value: unknown): SidebarThreadMetadataMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const normalized: SidebarThreadMetadataMap = {};
  Object.entries(value as Record<string, unknown>).forEach(
    ([threadId, entry]) => {
      const normalizedEntry = normalizeEntry(entry);
      if (normalizedEntry) {
        normalized[threadId] = normalizedEntry;
      }
    },
  );
  return normalized;
}

function hydrateFromRecord(value: unknown) {
  const normalized = normalizeRecord(value);
  metadataCache.clear();
  Object.entries(normalized).forEach(([threadId, entry]) => {
    metadataCache.set(threadId, entry);
  });
}

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  if (typeof window === "undefined") {
    return;
  }
  const payload = snapshotRecord();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (isTauri()) {
      void updatePersistedAtom(ATOM_KEY, payload);
    }
  } catch (error) {
    console.warn("Failed to persist sidebar thread metadata", error);
  }
}

function loadFromStorage() {
  if (hasLoaded) {
    return;
  }
  hasLoaded = true;
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      hydrateFromRecord(parsed);
    }
  } catch (error) {
    console.warn("Failed to load sidebar thread metadata", error);
  }

  if (!isTauri()) {
    return;
  }

  const localSnapshot = snapshotRecord();
  void syncPersistedAtom<SidebarThreadMetadataMap>(ATOM_KEY, localSnapshot)
    .then((hostSnapshot) => {
      const latestLocalSnapshot = snapshotRecord();
      const mergedSnapshot = {
        ...normalizeRecord(hostSnapshot),
        ...latestLocalSnapshot,
      };
      hydrateFromRecord(mergedSnapshot);
      persist();
      emit();
    })
    .catch((error) => {
      console.warn("Failed to sync sidebar thread metadata from host", error);
    });
}

export function getSidebarThreadMetadataMap(): SidebarThreadMetadataMap {
  loadFromStorage();
  return snapshotRecord();
}

export function getSidebarThreadMetadata(threadId: string) {
  loadFromStorage();
  return metadataCache.get(threadId) ?? {};
}

export function setSidebarThreadAlias(
  threadId: string,
  alias: string | undefined,
) {
  loadFromStorage();
  const current = metadataCache.get(threadId) ?? {};
  const nextAlias = normalizeAlias(alias);
  const nextEntry = {
    ...current,
    alias: nextAlias,
  };
  if (!nextEntry.pinned && !nextEntry.alias) {
    metadataCache.delete(threadId);
  } else {
    metadataCache.set(threadId, nextEntry);
  }
  persist();
  emit();
}

export function toggleSidebarThreadPinned(threadId: string) {
  loadFromStorage();
  const current = metadataCache.get(threadId) ?? {};
  const nextPinned = !current.pinned;
  const nextEntry = {
    ...current,
    pinned: nextPinned || undefined,
  };
  if (!nextEntry.pinned && !nextEntry.alias) {
    metadataCache.delete(threadId);
  } else {
    metadataCache.set(threadId, nextEntry);
  }
  persist();
  emit();
}

export function subscribeSidebarThreadMetadata(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarThreadMetadataMap() {
  const [metadata, setMetadata] = useState<SidebarThreadMetadataMap>(() =>
    getSidebarThreadMetadataMap(),
  );

  useEffect(() => {
    setMetadata(getSidebarThreadMetadataMap());
    return subscribeSidebarThreadMetadata(() => {
      setMetadata(getSidebarThreadMetadataMap());
    });
  }, []);

  return metadata;
}
