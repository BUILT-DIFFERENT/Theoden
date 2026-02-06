import { isTauri } from "@/app/utils/tauri";

const WORKSPACES_STORAGE_KEY = "theoden.workspaces";
const SELECTED_WORKSPACE_KEY = "theoden.selected.workspace";

export function loadStoredWorkspaces() {
  if (typeof window === "undefined") return [];
  if (!isTauri()) return [];
  try {
    const raw = window.localStorage.getItem(WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : [];
  } catch (error) {
    console.warn("Failed to load stored workspaces", error);
    return [];
  }
}

export function storeWorkspace(path: string) {
  if (typeof window === "undefined") return;
  if (!isTauri()) return;
  const normalized = path.trim();
  if (!normalized) return;
  const existing = new Set(loadStoredWorkspaces());
  existing.add(normalized);
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
  if (!isTauri()) return null;
  try {
    return window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
  } catch (error) {
    console.warn("Failed to load selected workspace", error);
    return null;
  }
}

export function storeSelectedWorkspace(path: string | null) {
  if (typeof window === "undefined") return;
  if (!isTauri()) return;
  try {
    if (!path) {
      window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, path);
  } catch (error) {
    console.warn("Failed to persist selected workspace", error);
  }
}
