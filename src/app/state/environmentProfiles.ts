import type { WorkspaceSummary } from "@/app/types";
import {
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

const ENVIRONMENT_PROFILES_STORAGE_KEY = "codex.environment.profiles";
const LEGACY_ENVIRONMENT_PROFILES_STORAGE_KEY = "theoden.environment.profiles";
const DEFAULT_ENVIRONMENT_PROFILE_ID = "default";

export type EnvironmentExecutionMode = "local" | "worktree" | "cloud";

export interface EnvironmentProfile {
  id: string;
  name: string;
  workspacePath: string;
  executionMode: EnvironmentExecutionMode;
  cloudRegion: string;
  autoCreateWorktrees: boolean;
}

interface StoredEnvironmentProfilesPayload {
  activeProfileId: string | null;
  profiles: EnvironmentProfile[];
}

interface EnvironmentProfileFallback {
  executionMode: EnvironmentExecutionMode;
  cloudRegion: string;
  autoCreateWorktrees: boolean;
}

interface LoadStoredEnvironmentProfilesOptions {
  workspaces: WorkspaceSummary[];
  fallback: EnvironmentProfileFallback;
  preferredWorkspacePath?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function readExecutionMode(
  record: Record<string, unknown>,
  key: string,
  fallback: EnvironmentExecutionMode,
) {
  const value = record[key];
  if (value === "local" || value === "worktree" || value === "cloud") {
    return value;
  }
  return fallback;
}

export function environmentProfileIdFromWorkspace(path?: string | null) {
  if (!path) {
    return null;
  }
  const normalizedPath = normalizeWorkspacePath(path);
  if (!normalizedPath) {
    return null;
  }
  return normalizedPath.toLowerCase();
}

function createWorkspaceProfile(
  workspace: WorkspaceSummary,
  fallback: EnvironmentProfileFallback,
): EnvironmentProfile | null {
  const workspacePath = normalizeWorkspacePath(workspace.path);
  if (!workspacePath) {
    return null;
  }
  const id = environmentProfileIdFromWorkspace(workspacePath);
  if (!id) {
    return null;
  }
  return {
    id,
    name: workspace.name || workspaceNameFromPath(workspacePath),
    workspacePath,
    executionMode: fallback.executionMode,
    cloudRegion: fallback.cloudRegion,
    autoCreateWorktrees: fallback.autoCreateWorktrees,
  };
}

function parseStoredProfiles(
  raw: string,
  fallback: EnvironmentProfileFallback,
): StoredEnvironmentProfilesPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return null;
    }
    const activeProfileId =
      typeof record.activeProfileId === "string"
        ? record.activeProfileId
        : null;
    const rawProfiles = Array.isArray(record.profiles) ? record.profiles : [];
    const profiles = rawProfiles
      .map((entry) => {
        const item = asRecord(entry);
        if (!item) {
          return null;
        }
        const workspacePathValue = readString(item, "workspacePath", "");
        const workspacePath = workspacePathValue
          ? normalizeWorkspacePath(workspacePathValue)
          : "";
        const id =
          workspacePath.trim().length > 0
            ? (environmentProfileIdFromWorkspace(workspacePath) ??
              DEFAULT_ENVIRONMENT_PROFILE_ID)
            : readString(item, "id", DEFAULT_ENVIRONMENT_PROFILE_ID);
        const fallbackName = workspacePath
          ? workspaceNameFromPath(workspacePath)
          : "Default local";
        return {
          id,
          name: readString(item, "name", fallbackName),
          workspacePath,
          executionMode: readExecutionMode(
            item,
            "executionMode",
            fallback.executionMode,
          ),
          cloudRegion: readString(item, "cloudRegion", fallback.cloudRegion),
          autoCreateWorktrees: readBoolean(
            item,
            "autoCreateWorktrees",
            fallback.autoCreateWorktrees,
          ),
        } satisfies EnvironmentProfile;
      })
      .filter((profile): profile is EnvironmentProfile => Boolean(profile));
    return {
      activeProfileId,
      profiles,
    };
  } catch {
    return null;
  }
}

function loadStoredPayload(
  fallback: EnvironmentProfileFallback,
): StoredEnvironmentProfilesPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw =
    window.localStorage.getItem(ENVIRONMENT_PROFILES_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_ENVIRONMENT_PROFILES_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const parsed = parseStoredProfiles(raw, fallback);
  if (
    parsed &&
    !window.localStorage.getItem(ENVIRONMENT_PROFILES_STORAGE_KEY)
  ) {
    window.localStorage.setItem(
      ENVIRONMENT_PROFILES_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  }
  return parsed;
}

export function loadStoredEnvironmentProfiles(
  options: LoadStoredEnvironmentProfilesOptions,
) {
  const fallback = options.fallback;
  const baseProfilesMap = new Map<string, EnvironmentProfile>();
  options.workspaces.forEach((workspace) => {
    const profile = createWorkspaceProfile(workspace, fallback);
    if (!profile) {
      return;
    }
    baseProfilesMap.set(profile.id, profile);
  });
  if (!baseProfilesMap.size) {
    baseProfilesMap.set(DEFAULT_ENVIRONMENT_PROFILE_ID, {
      id: DEFAULT_ENVIRONMENT_PROFILE_ID,
      name: "Default local",
      workspacePath: "",
      executionMode: fallback.executionMode,
      cloudRegion: fallback.cloudRegion,
      autoCreateWorktrees: fallback.autoCreateWorktrees,
    });
  }
  const baseProfiles = Array.from(baseProfilesMap.values());
  const storedPayload = loadStoredPayload(fallback);
  const storedProfilesById = new Map<string, EnvironmentProfile>();
  storedPayload?.profiles.forEach((profile) => {
    storedProfilesById.set(profile.id, profile);
  });

  const profiles = baseProfiles.map((profile) => {
    const stored = storedProfilesById.get(profile.id);
    if (!stored) {
      return profile;
    }
    return {
      ...profile,
      name: stored.name,
      executionMode: stored.executionMode,
      cloudRegion: stored.cloudRegion,
      autoCreateWorktrees: stored.autoCreateWorktrees,
    };
  });

  const preferredProfileId = environmentProfileIdFromWorkspace(
    options.preferredWorkspacePath,
  );
  const activeProfileIdCandidates = [
    preferredProfileId,
    storedPayload?.activeProfileId ?? null,
    profiles[0]?.id ?? null,
  ];
  const activeProfileId =
    activeProfileIdCandidates.find(
      (candidate) =>
        candidate && profiles.some((item) => item.id === candidate),
    ) ?? null;

  return {
    activeProfileId,
    profiles,
  };
}

export function storeEnvironmentProfiles(snapshot: {
  activeProfileId: string | null;
  profiles: EnvironmentProfile[];
}) {
  if (typeof window === "undefined") {
    return;
  }
  const payload: StoredEnvironmentProfilesPayload = {
    activeProfileId: snapshot.activeProfileId,
    profiles: snapshot.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      workspacePath: profile.workspacePath,
      executionMode: profile.executionMode,
      cloudRegion: profile.cloudRegion,
      autoCreateWorktrees: profile.autoCreateWorktrees,
    })),
  };
  try {
    window.localStorage.setItem(
      ENVIRONMENT_PROFILES_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.warn("Failed to persist environment profiles", error);
  }
}
