import {
  syncPersistedAtom,
  updatePersistedAtom,
} from "@/app/services/host/persistedState";
import { isTauri } from "@/app/utils/tauri";

const SIDEBAR_UI_STORAGE_KEY = "codex.sidebar.ui";
const SIDEBAR_UI_ATOM_KEY = "sidebar.ui";

export type SidebarThreadSort = "updated" | "title";
export type SidebarThreadVisibility = "all" | "active";
export type SidebarGroupMode = "workspace" | "recency";

export interface SidebarUiSnapshot {
  threadSort: SidebarThreadSort;
  threadVisibility: SidebarThreadVisibility;
  groupMode: SidebarGroupMode;
  expandedWorkspaceKeys: string[];
  scrollTop: number;
}

export const defaultSidebarUiSnapshot: SidebarUiSnapshot = {
  threadSort: "updated",
  threadVisibility: "all",
  groupMode: "workspace",
  expandedWorkspaceKeys: [],
  scrollTop: 0,
};

function normalizeSidebarUiSnapshot(
  value: unknown,
  fallback: SidebarUiSnapshot,
): SidebarUiSnapshot {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const threadSort =
    record.threadSort === "title" ? "title" : fallback.threadSort;
  const threadVisibility =
    record.threadVisibility === "active" ? "active" : fallback.threadVisibility;
  const groupMode =
    record.groupMode === "recency" ? "recency" : fallback.groupMode;
  const expandedWorkspaceKeys = Array.isArray(record.expandedWorkspaceKeys)
    ? record.expandedWorkspaceKeys.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : fallback.expandedWorkspaceKeys;
  const scrollTop =
    typeof record.scrollTop === "number" && Number.isFinite(record.scrollTop)
      ? Math.max(0, record.scrollTop)
      : fallback.scrollTop;

  return {
    threadSort,
    threadVisibility,
    groupMode,
    expandedWorkspaceKeys: Array.from(new Set(expandedWorkspaceKeys)),
    scrollTop,
  };
}

function saveSidebarUiLocally(snapshot: SidebarUiSnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SIDEBAR_UI_STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadStoredSidebarUi(
  fallback: SidebarUiSnapshot = defaultSidebarUiSnapshot,
) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_UI_STORAGE_KEY);
    const parsed = raw
      ? normalizeSidebarUiSnapshot(JSON.parse(raw), fallback)
      : fallback;
    if (!raw) {
      saveSidebarUiLocally(parsed);
    }

    if (isTauri()) {
      void syncPersistedAtom<SidebarUiSnapshot>(
        SIDEBAR_UI_ATOM_KEY,
        parsed,
      ).then((hostSnapshot) => {
        const normalizedHost = normalizeSidebarUiSnapshot(hostSnapshot, parsed);
        saveSidebarUiLocally(normalizedHost);
      });
    }

    return parsed;
  } catch (error) {
    console.warn("Failed to load sidebar UI state", error);
    return fallback;
  }
}

export function storeSidebarUi(snapshot: SidebarUiSnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeSidebarUiSnapshot(
    snapshot,
    defaultSidebarUiSnapshot,
  );
  try {
    saveSidebarUiLocally(normalized);
    void updatePersistedAtom(SIDEBAR_UI_ATOM_KEY, normalized);
  } catch (error) {
    console.warn("Failed to persist sidebar UI state", error);
  }
}
