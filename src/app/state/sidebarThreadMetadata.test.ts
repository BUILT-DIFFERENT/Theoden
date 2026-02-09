import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("sidebarThreadMetadata", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
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
});
