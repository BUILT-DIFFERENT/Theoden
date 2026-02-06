import { beforeEach, describe, expect, it } from "vitest";

import {
  loadCachedThreadDetail,
  loadCachedThreadSummaries,
  storeCachedThreadDetail,
  storeCachedThreadSummaries,
} from "@/app/state/threadCache";
import type { ThreadDetail, ThreadMessage, ThreadSummary } from "@/app/types";

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

const threadSummary: ThreadSummary = {
  id: "thread-1",
  title: "Fix parser",
  subtitle: "/repo/theoden",
  status: "done",
  projectId: "/repo/theoden",
  lastUpdated: "1m",
};

const threadDetail: ThreadDetail = {
  ...threadSummary,
  mode: "local",
  effort: "medium",
  events: [],
  attachments: [],
  diffSummary: {
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    files: [],
  },
};

const threadMessages: ThreadMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "Done.",
  },
];

describe("threadCache", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
  });

  it("stores and loads thread summaries", () => {
    storeCachedThreadSummaries([threadSummary]);

    expect(loadCachedThreadSummaries()).toEqual([threadSummary]);
  });

  it("stores and loads per-thread detail snapshots", () => {
    storeCachedThreadDetail(threadSummary.id, {
      thread: threadDetail,
      messages: threadMessages,
    });

    const cached = loadCachedThreadDetail(threadSummary.id);
    expect(cached?.thread).toEqual(threadDetail);
    expect(cached?.messages).toEqual(threadMessages);
    expect(typeof cached?.cachedAt).toBe("number");
  });

  it("returns null for unknown thread detail", () => {
    expect(loadCachedThreadDetail("missing-thread")).toBeNull();
  });
});
