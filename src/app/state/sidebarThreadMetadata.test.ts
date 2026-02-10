import { beforeEach, describe, expect, it, vi } from "vitest";

const { syncPersistedAtomMock, updatePersistedAtomMock, isTauriMock } =
  vi.hoisted(() => ({
    syncPersistedAtomMock: vi.fn(),
    updatePersistedAtomMock: vi.fn(),
    isTauriMock: vi.fn(),
  }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

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

describe("sidebarThreadMetadata", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
    syncPersistedAtomMock.mockReset();
    updatePersistedAtomMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
  });

  it("stores alias and pin metadata for a thread", async () => {
    const metadata = await import("@/app/state/sidebarThreadMetadata");

    metadata.setSidebarThreadAlias("thread-1", "  Focus thread  ");
    metadata.toggleSidebarThreadPinned("thread-1");

    expect(metadata.getSidebarThreadMetadata("thread-1")).toEqual({
      alias: "Focus thread",
      pinned: true,
    });
    expect(metadata.getSidebarThreadMetadataMap()).toEqual({
      "thread-1": {
        alias: "Focus thread",
        pinned: true,
      },
    });
  });

  it("drops metadata when alias is cleared and pin is removed", async () => {
    const metadata = await import("@/app/state/sidebarThreadMetadata");

    metadata.setSidebarThreadAlias("thread-2", "Temporary alias");
    metadata.toggleSidebarThreadPinned("thread-2");
    metadata.setSidebarThreadAlias("thread-2", undefined);
    metadata.toggleSidebarThreadPinned("thread-2");

    expect(metadata.getSidebarThreadMetadata("thread-2")).toEqual({});
    expect(metadata.getSidebarThreadMetadataMap()).toEqual({});
  });

  it("merges host sync data without clobbering local updates made during sync", async () => {
    isTauriMock.mockReturnValue(true);
    const syncDeferred = deferred<Record<string, unknown>>();
    syncPersistedAtomMock.mockReturnValue(syncDeferred.promise);

    const metadata = await import("@/app/state/sidebarThreadMetadata");
    expect(metadata.getSidebarThreadMetadataMap()).toEqual({});
    expect(syncPersistedAtomMock).toHaveBeenCalledTimes(1);

    metadata.setSidebarThreadAlias("thread-1", "Local alias");
    metadata.toggleSidebarThreadPinned("thread-1");

    syncDeferred.resolve({
      "thread-1": { alias: "Host alias", pinned: false },
      "thread-2": { alias: "Host only" },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(metadata.getSidebarThreadMetadataMap()).toEqual({
      "thread-1": {
        alias: "Local alias",
        pinned: true,
      },
      "thread-2": {
        alias: "Host only",
      },
    });
  });
});
