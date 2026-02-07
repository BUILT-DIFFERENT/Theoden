import {
  resetPersistedAtom,
  syncPersistedAtom,
  updatePersistedAtom,
} from "@/app/services/host/persistedState";
import { isTauri } from "@/app/utils/tauri";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

const WORKSPACES_STORAGE_KEY = "codex.workspaces";
const LEGACY_WORKSPACES_STORAGE_KEY = "theoden.workspaces";
const SELECTED_WORKSPACE_KEY = "codex.selected.workspace";
const LEGACY_SELECTED_WORKSPACE_KEY = "theoden.selected.workspace";
const WORKSPACES_ATOM_KEY = "workspace.list";
const SELECTED_WORKSPACE_ATOM_KEY = "workspace.selected";

function normalizeStoredPath(path: string) {
  return normalizeWorkspacePath(path);
}

function workspacePathKey(path: string) {
  return normalizeStoredPath(path).toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function loadStoredWorkspaces() {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(WORKSPACES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const deduped = new Map<string, string>();
    parsed.forEach((value) => {
      if (!isNonEmptyString(value)) {
        return;
      }
      const normalized = normalizeStoredPath(value);
      deduped.set(workspacePathKey(normalized), normalized);
    });
    const normalizedWorkspaces = Array.from(deduped.values());
    if (isTauri()) {
      void syncPersistedAtom<string[]>(
        WORKSPACES_ATOM_KEY,
        normalizedWorkspaces,
      ).then((hostWorkspaces) => {
        if (!Array.isArray(hostWorkspaces)) {
          return;
        }
        const normalizedHost = hostWorkspaces
          .map((path) => normalizeStoredPath(path))
          .filter(Boolean);
        window.localStorage.setItem(
          WORKSPACES_STORAGE_KEY,
          JSON.stringify(normalizedHost),
        );
      });
    }
    const currentRaw = window.localStorage.getItem(WORKSPACES_STORAGE_KEY);
    if (!currentRaw && normalizedWorkspaces.length) {
      window.localStorage.setItem(
        WORKSPACES_STORAGE_KEY,
        JSON.stringify(normalizedWorkspaces),
      );
    }
    return normalizedWorkspaces;
  } catch (error) {
    console.warn("Failed to load stored workspaces", error);
    return [];
  }
}

export function storeWorkspace(path: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeStoredPath(path);
  if (!normalized) return;

  const existing = new Map<string, string>();
  loadStoredWorkspaces().forEach((workspacePath) => {
    existing.set(workspacePathKey(workspacePath), workspacePath);
  });
  existing.set(workspacePathKey(normalized), normalized);

  try {
    const values = Array.from(existing.values());
    window.localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(values));
    void updatePersistedAtom(WORKSPACES_ATOM_KEY, values);
  } catch (error) {
    console.warn("Failed to persist workspace list", error);
  }
}

export function removeStoredWorkspace(path: string) {
  if (typeof window === "undefined") return;
  const keyToRemove = workspacePathKey(path);
  const remaining = loadStoredWorkspaces().filter(
    (workspacePath) => workspacePathKey(workspacePath) !== keyToRemove,
  );
  try {
    if (remaining.length) {
      window.localStorage.setItem(
        WORKSPACES_STORAGE_KEY,
        JSON.stringify(remaining),
      );
      void updatePersistedAtom(WORKSPACES_ATOM_KEY, remaining);
    } else {
      window.localStorage.removeItem(WORKSPACES_STORAGE_KEY);
      void resetPersistedAtom(WORKSPACES_ATOM_KEY);
    }
  } catch (error) {
    console.warn("Failed to remove workspace from storage", error);
  }
}

export function loadSelectedWorkspace() {
  if (typeof window === "undefined") return null;
  try {
    const selectedWorkspace =
      window.localStorage.getItem(SELECTED_WORKSPACE_KEY) ??
      window.localStorage.getItem(LEGACY_SELECTED_WORKSPACE_KEY);
    if (!selectedWorkspace) {
      return null;
    }
    const normalized = normalizeStoredPath(selectedWorkspace);
    if (isTauri()) {
      void syncPersistedAtom<string | null>(
        SELECTED_WORKSPACE_ATOM_KEY,
        normalized,
      ).then((hostSelection) => {
        if (!hostSelection) {
          return;
        }
        window.localStorage.setItem(
          SELECTED_WORKSPACE_KEY,
          normalizeStoredPath(hostSelection),
        );
      });
    }
    if (!window.localStorage.getItem(SELECTED_WORKSPACE_KEY)) {
      window.localStorage.setItem(SELECTED_WORKSPACE_KEY, normalized);
    }
    return normalized;
  } catch (error) {
    console.warn("Failed to load selected workspace", error);
    return null;
  }
}

export function storeSelectedWorkspace(path: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!path) {
      window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
      void resetPersistedAtom(SELECTED_WORKSPACE_ATOM_KEY);
      return;
    }
    const normalized = normalizeStoredPath(path);
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, normalized);
    void updatePersistedAtom(SELECTED_WORKSPACE_ATOM_KEY, normalized);
  } catch (error) {
    console.warn("Failed to persist selected workspace", error);
  }
}

export function clearSelectedWorkspace() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
    window.localStorage.removeItem(LEGACY_SELECTED_WORKSPACE_KEY);
    void resetPersistedAtom(SELECTED_WORKSPACE_ATOM_KEY);
  } catch (error) {
    console.warn("Failed to clear selected workspace", error);
  }
}
