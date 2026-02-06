import { beforeEach, describe, expect, it } from "vitest";

import {
  environmentProfileIdFromWorkspace,
  loadStoredEnvironmentProfiles,
  storeEnvironmentProfiles,
} from "@/app/state/environmentProfiles";
import type { WorkspaceSummary } from "@/app/types";

function createWorkspace(path: string, name: string): WorkspaceSummary {
  return {
    id: path,
    name,
    path,
    source: "config",
  };
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

describe("environmentProfiles", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
  });

  it("loads workspace profiles and applies stored overrides", () => {
    const workspaces = [
      createWorkspace("/repo/alpha", "Alpha"),
      createWorkspace("/repo/beta", "Beta"),
    ];
    storeEnvironmentProfiles({
      activeProfileId: environmentProfileIdFromWorkspace("/repo/alpha"),
      profiles: [
        {
          id: "ignored",
          name: "Alpha prod",
          workspacePath: "/repo/alpha",
          executionMode: "cloud",
          cloudRegion: "eu-central",
          autoCreateWorktrees: false,
        },
      ],
    });

    const snapshot = loadStoredEnvironmentProfiles({
      workspaces,
      preferredWorkspacePath: "/repo/beta",
      fallback: {
        executionMode: "local",
        cloudRegion: "us-east",
        autoCreateWorktrees: true,
      },
    });

    expect(snapshot).toEqual({
      activeProfileId: environmentProfileIdFromWorkspace("/repo/beta"),
      profiles: [
        {
          id: environmentProfileIdFromWorkspace("/repo/alpha"),
          name: "Alpha prod",
          workspacePath: "/repo/alpha",
          executionMode: "cloud",
          cloudRegion: "eu-central",
          autoCreateWorktrees: false,
        },
        {
          id: environmentProfileIdFromWorkspace("/repo/beta"),
          name: "Beta",
          workspacePath: "/repo/beta",
          executionMode: "local",
          cloudRegion: "us-east",
          autoCreateWorktrees: true,
        },
      ],
    });
  });

  it("returns a default local profile when no workspaces are available", () => {
    const snapshot = loadStoredEnvironmentProfiles({
      workspaces: [],
      fallback: {
        executionMode: "worktree",
        cloudRegion: "us-west",
        autoCreateWorktrees: false,
      },
    });

    expect(snapshot).toEqual({
      activeProfileId: "default",
      profiles: [
        {
          id: "default",
          name: "Default local",
          workspacePath: "",
          executionMode: "worktree",
          cloudRegion: "us-west",
          autoCreateWorktrees: false,
        },
      ],
    });
  });
});
