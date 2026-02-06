import { normalizeWorkspacePath } from "@/app/utils/workspace";

const WORKSPACES_STORAGE_KEY = "theoden.workspaces";
const SELECTED_WORKSPACE_KEY = "theoden.selected.workspace";

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
    const raw = window.localStorage.getItem(WORKSPACES_STORAGE_KEY);
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
    return Array.from(deduped.values());
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
    window.localStorage.setItem(
      WORKSPACES_STORAGE_KEY,
      JSON.stringify(Array.from(existing.values())),
    );
  } catch (error) {
    console.warn("Failed to persist workspace list", error);
  }
}

export function loadSelectedWorkspace() {
  if (typeof window === "undefined") return null;
  try {
    const selectedWorkspace = window.localStorage.getItem(
      SELECTED_WORKSPACE_KEY,
    );
    if (!selectedWorkspace) {
      return null;
    }
    return normalizeStoredPath(selectedWorkspace);
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
      return;
    }
    window.localStorage.setItem(
      SELECTED_WORKSPACE_KEY,
      normalizeStoredPath(path),
    );
  } catch (error) {
    console.warn("Failed to persist selected workspace", error);
  }
}
