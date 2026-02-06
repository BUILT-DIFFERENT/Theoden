import { useEffect, useState } from "react";

import { isTauri } from "@/app/utils/tauri";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

export interface DiffAnnotation {
  id: string;
  path: string;
  lineNumber: number;
  content: string;
  comment: string;
  createdAt: number;
}

const STORAGE_KEY = "codex.thread.annotations";
const cache = new Map<string, DiffAnnotation[]>();
const listeners = new Map<string, Set<() => void>>();
let loaded = false;

function loadCache() {
  if (loaded) {
    return;
  }
  loaded = true;
  if (typeof window === "undefined") {
    return;
  }
  if (!isTauri()) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Record<string, DiffAnnotation[]>;
    Object.entries(parsed).forEach(([scope, annotations]) => {
      if (!Array.isArray(annotations)) {
        return;
      }
      const safeAnnotations = annotations.filter(
        (annotation) =>
          annotation &&
          typeof annotation === "object" &&
          typeof annotation.id === "string" &&
          typeof annotation.path === "string" &&
          typeof annotation.lineNumber === "number" &&
          typeof annotation.comment === "string" &&
          typeof annotation.createdAt === "number",
      );
      cache.set(scope, safeAnnotations);
    });
  } catch (error) {
    console.warn("Failed to load persisted diff annotations", error);
  }
}

function persistCache() {
  if (typeof window === "undefined") {
    return;
  }
  if (!isTauri()) {
    return;
  }
  try {
    const payload: Record<string, DiffAnnotation[]> = {};
    cache.forEach((annotations, scope) => {
      payload[scope] = annotations;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist diff annotations", error);
  }
}

function emit(scope: string) {
  const scopeListeners = listeners.get(scope);
  if (!scopeListeners) {
    return;
  }
  scopeListeners.forEach((listener) => listener());
}

export function annotationScopeKey(
  threadId?: string,
  workspacePath?: string | null,
) {
  if (threadId) {
    return `thread:${threadId}`;
  }
  if (workspacePath) {
    return `workspace:${normalizeWorkspacePath(workspacePath).toLowerCase()}`;
  }
  return "workspace:global";
}

export function getDiffAnnotations(scope: string) {
  loadCache();
  return cache.get(scope) ?? [];
}

export function addDiffAnnotation(scope: string, annotation: DiffAnnotation) {
  loadCache();
  const existing = cache.get(scope) ?? [];
  cache.set(scope, [...existing, annotation]);
  persistCache();
  emit(scope);
}

export function useDiffAnnotations(scope: string) {
  const [annotations, setAnnotations] = useState<DiffAnnotation[]>(() =>
    getDiffAnnotations(scope),
  );

  useEffect(() => {
    setAnnotations(getDiffAnnotations(scope));
    const scopeListeners = listeners.get(scope) ?? new Set();
    const handleUpdate = () => {
      setAnnotations(getDiffAnnotations(scope));
    };
    scopeListeners.add(handleUpdate);
    listeners.set(scope, scopeListeners);
    return () => {
      const currentListeners = listeners.get(scope);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(handleUpdate);
      if (!currentListeners.size) {
        listeners.delete(scope);
      }
    };
  }, [scope]);

  const addAnnotation = (annotation: DiffAnnotation) => {
    addDiffAnnotation(scope, annotation);
  };

  return {
    annotations,
    addAnnotation,
  };
}
