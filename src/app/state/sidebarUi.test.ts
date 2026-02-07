import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultSidebarUiSnapshot,
  loadStoredSidebarUi,
  storeSidebarUi,
} from "@/app/state/sidebarUi";

const { syncPersistedAtomMock, updatePersistedAtomMock, isTauriMock } =
  vi.hoisted(() => ({
    syncPersistedAtomMock: vi.fn(),
    updatePersistedAtomMock: vi.fn(),
    isTauriMock: vi.fn(),
  }));

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

vi.mock("@/app/services/host/persistedState", () => ({
  syncPersistedAtom: syncPersistedAtomMock,
  updatePersistedAtom: updatePersistedAtomMock,
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: isTauriMock,
}));

describe("sidebarUi state helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
    syncPersistedAtomMock.mockReset();
    updatePersistedAtomMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores normalized sidebar state locally and in host atoms", () => {
    storeSidebarUi({
      threadSort: "title",
      threadVisibility: "active",
      expandedWorkspaceKeys: ["a", "b", "a", "", " "],
      scrollTop: -20,
    });

    expect(updatePersistedAtomMock).toHaveBeenCalledWith("sidebar.ui", {
      threadSort: "title",
      threadVisibility: "active",
      expandedWorkspaceKeys: ["a", "b"],
      scrollTop: 0,
    });
    expect(
      JSON.parse(window.localStorage.getItem("codex.sidebar.ui") ?? "{}"),
    ).toEqual({
      threadSort: "title",
      threadVisibility: "active",
      expandedWorkspaceKeys: ["a", "b"],
      scrollTop: 0,
    });
  });

  it("loads fallback values when local state is missing or malformed", () => {
    window.localStorage.setItem(
      "codex.sidebar.ui",
      JSON.stringify({
        threadSort: "invalid",
        threadVisibility: "invalid",
        expandedWorkspaceKeys: ["workspace-a", 7],
        scrollTop: "NaN",
      }),
    );

    const loaded = loadStoredSidebarUi();

    expect(loaded).toEqual({
      ...defaultSidebarUiSnapshot,
      expandedWorkspaceKeys: ["workspace-a"],
    });
  });

  it("syncs host sidebar state into local storage in desktop mode", async () => {
    isTauriMock.mockReturnValue(true);
    syncPersistedAtomMock.mockResolvedValue({
      threadSort: "title",
      threadVisibility: "active",
      expandedWorkspaceKeys: ["workspace-z"],
      scrollTop: 144,
    });

    const loaded = loadStoredSidebarUi();

    expect(loaded).toEqual(defaultSidebarUiSnapshot);
    expect(syncPersistedAtomMock).toHaveBeenCalledWith(
      "sidebar.ui",
      defaultSidebarUiSnapshot,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(
      JSON.parse(window.localStorage.getItem("codex.sidebar.ui") ?? "{}"),
    ).toEqual({
      threadSort: "title",
      threadVisibility: "active",
      expandedWorkspaceKeys: ["workspace-z"],
      scrollTop: 144,
    });
  });
});
