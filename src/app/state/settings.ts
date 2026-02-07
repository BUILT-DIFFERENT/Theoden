import {
  syncPersistedAtom,
  updatePersistedAtom,
} from "@/app/services/host/persistedState";
import { isTauri } from "@/app/utils/tauri";

const SETTINGS_STORAGE_KEY = "codex.settings";
const LEGACY_SETTINGS_STORAGE_KEY = "theoden.settings";
const SETTINGS_UPDATED_EVENT_NAME = "codex:settings-updated";
const SETTINGS_ATOM_KEY = "settings.snapshot";

export interface StoredSettingsSnapshot {
  theme: "system" | "light" | "dark";
  openDestination: string;
  followUpBehavior: "append" | "new-thread" | "ask";
  compactComposer: boolean;
  displayName: string;
  responseTone: "balanced" | "concise" | "verbose";
  showTimestamps: boolean;
  includeProjectOverrides: boolean;
  showExperimentalConfig: boolean;
  mcpRequestTimeout: string;
  allowCommunitySkills: boolean;
  autoRefreshSkills: boolean;
  requireSkillReview: boolean;
  gitAuthorName: string;
  gitAuthorEmail: string;
  defaultBranch: string;
  autoSignCommits: boolean;
  defaultEnvironment: "local" | "worktree" | "cloud";
  autoCreateWorktrees: boolean;
  cloudRegion: string;
  worktreeStrategy: "clone" | "git_worktree";
  worktreeBranchPrefix: string;
  worktreeRetentionDays: string;
  autoPruneMergedWorktrees: boolean;
  archiveRetentionDays: string;
  autoArchiveCompleted: boolean;
}

function defaultSettings(
  defaultOpenDestination: string,
): StoredSettingsSnapshot {
  return {
    theme: "system",
    openDestination: defaultOpenDestination,
    followUpBehavior: "append",
    compactComposer: true,
    displayName: "Codex Operator",
    responseTone: "balanced",
    showTimestamps: true,
    includeProjectOverrides: true,
    showExperimentalConfig: false,
    mcpRequestTimeout: "30",
    allowCommunitySkills: true,
    autoRefreshSkills: true,
    requireSkillReview: true,
    gitAuthorName: "Codex Bot",
    gitAuthorEmail: "codex@example.com",
    defaultBranch: "main",
    autoSignCommits: false,
    defaultEnvironment: "local",
    autoCreateWorktrees: true,
    cloudRegion: "us-east",
    worktreeStrategy: "git_worktree",
    worktreeBranchPrefix: "codex/thread",
    worktreeRetentionDays: "7",
    autoPruneMergedWorktrees: true,
    archiveRetentionDays: "30",
    autoArchiveCompleted: true,
  };
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

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const value = record[key];
  if (typeof value !== "string") {
    return fallback;
  }
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function loadStoredSettings(
  defaultOpenDestination: string,
): StoredSettingsSnapshot {
  const fallback = defaultSettings(defaultOpenDestination);
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw =
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return fallback;
    }

    const settings = {
      theme: readEnum(
        record,
        "theme",
        ["system", "light", "dark"],
        fallback.theme,
      ),
      openDestination: readString(
        record,
        "openDestination",
        fallback.openDestination,
      ),
      followUpBehavior: readEnum(
        record,
        "followUpBehavior",
        ["append", "new-thread", "ask"],
        fallback.followUpBehavior,
      ),
      compactComposer: readBoolean(
        record,
        "compactComposer",
        fallback.compactComposer,
      ),
      displayName: readString(record, "displayName", fallback.displayName),
      responseTone: readEnum(
        record,
        "responseTone",
        ["balanced", "concise", "verbose"],
        fallback.responseTone,
      ),
      showTimestamps: readBoolean(
        record,
        "showTimestamps",
        fallback.showTimestamps,
      ),
      includeProjectOverrides: readBoolean(
        record,
        "includeProjectOverrides",
        fallback.includeProjectOverrides,
      ),
      showExperimentalConfig: readBoolean(
        record,
        "showExperimentalConfig",
        fallback.showExperimentalConfig,
      ),
      mcpRequestTimeout: readString(
        record,
        "mcpRequestTimeout",
        fallback.mcpRequestTimeout,
      ),
      allowCommunitySkills: readBoolean(
        record,
        "allowCommunitySkills",
        fallback.allowCommunitySkills,
      ),
      autoRefreshSkills: readBoolean(
        record,
        "autoRefreshSkills",
        fallback.autoRefreshSkills,
      ),
      requireSkillReview: readBoolean(
        record,
        "requireSkillReview",
        fallback.requireSkillReview,
      ),
      gitAuthorName: readString(
        record,
        "gitAuthorName",
        fallback.gitAuthorName,
      ),
      gitAuthorEmail: readString(
        record,
        "gitAuthorEmail",
        fallback.gitAuthorEmail,
      ),
      defaultBranch: readString(
        record,
        "defaultBranch",
        fallback.defaultBranch,
      ),
      autoSignCommits: readBoolean(
        record,
        "autoSignCommits",
        fallback.autoSignCommits,
      ),
      defaultEnvironment: readEnum(
        record,
        "defaultEnvironment",
        ["local", "worktree", "cloud"],
        fallback.defaultEnvironment,
      ),
      autoCreateWorktrees: readBoolean(
        record,
        "autoCreateWorktrees",
        fallback.autoCreateWorktrees,
      ),
      cloudRegion: readString(record, "cloudRegion", fallback.cloudRegion),
      worktreeStrategy: readEnum(
        record,
        "worktreeStrategy",
        ["clone", "git_worktree"],
        fallback.worktreeStrategy,
      ),
      worktreeBranchPrefix: readString(
        record,
        "worktreeBranchPrefix",
        fallback.worktreeBranchPrefix,
      ),
      worktreeRetentionDays: readString(
        record,
        "worktreeRetentionDays",
        fallback.worktreeRetentionDays,
      ),
      autoPruneMergedWorktrees: readBoolean(
        record,
        "autoPruneMergedWorktrees",
        fallback.autoPruneMergedWorktrees,
      ),
      archiveRetentionDays: readString(
        record,
        "archiveRetentionDays",
        fallback.archiveRetentionDays,
      ),
      autoArchiveCompleted: readBoolean(
        record,
        "autoArchiveCompleted",
        fallback.autoArchiveCompleted,
      ),
    };
    if (isTauri()) {
      void syncPersistedAtom<StoredSettingsSnapshot>(
        SETTINGS_ATOM_KEY,
        settings,
      )
        .then((hostSettings) => {
          const merged = {
            ...settings,
            ...hostSettings,
          };
          window.localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(merged),
          );
          window.dispatchEvent(
            new CustomEvent<StoredSettingsSnapshot>(
              SETTINGS_UPDATED_EVENT_NAME,
              {
                detail: merged,
              },
            ),
          );
        })
        .catch((error) => {
          console.warn("Failed to sync settings from host", error);
        });
    }
    if (!window.localStorage.getItem(SETTINGS_STORAGE_KEY)) {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );
    }
    return settings;
  } catch (error) {
    console.warn("Failed to load stored settings", error);
    return fallback;
  }
}

export function storeSettings(settings: StoredSettingsSnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    void updatePersistedAtom(SETTINGS_ATOM_KEY, settings);
    window.dispatchEvent(
      new CustomEvent<StoredSettingsSnapshot>(SETTINGS_UPDATED_EVENT_NAME, {
        detail: settings,
      }),
    );
  } catch (error) {
    console.warn("Failed to store settings", error);
  }
}

export function subscribeSettingsUpdates(
  listener: (settings: StoredSettingsSnapshot | null) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleSettingsUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<StoredSettingsSnapshot>;
    listener(customEvent.detail ?? null);
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== SETTINGS_STORAGE_KEY &&
      event.key !== LEGACY_SETTINGS_STORAGE_KEY
    ) {
      return;
    }
    listener(null);
  };
  window.addEventListener(SETTINGS_UPDATED_EVENT_NAME, handleSettingsUpdate);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(
      SETTINGS_UPDATED_EVENT_NAME,
      handleSettingsUpdate,
    );
    window.removeEventListener("storage", handleStorage);
  };
}
