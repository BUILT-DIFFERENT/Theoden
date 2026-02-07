import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { execCommand } from "@/app/services/cli/commands";
import {
  loadAuthStatus,
  loadMergedConfig,
  loadMcpServerStatuses,
  mcpServersFromConfig,
  providersFromConfig,
  validateConfig,
  type MappedMcpServer,
  type MappedProviderStatus,
} from "@/app/services/cli/config";
import { listThreads, unarchiveThread } from "@/app/services/cli/threads";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  environmentProfileIdFromWorkspace,
  loadStoredEnvironmentProfiles,
  storeEnvironmentProfiles,
  type EnvironmentProfile,
} from "@/app/state/environmentProfiles";
import {
  loadStoredSettings,
  storeSettings,
  type StoredSettingsSnapshot,
} from "@/app/state/settings";
import {
  defaultSettingsSection,
  mockEditors,
  settingsSections,
  type SettingsSectionId,
} from "@/app/state/settingsData";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";

const fallbackProviderStatuses: MappedProviderStatus[] = [
  {
    id: "local",
    status: isTauri() ? "ready" : "unavailable",
    detail: isTauri()
      ? "Desktop runtime connected"
      : "Desktop runtime unavailable",
  },
  {
    id: "worktree",
    status: "unavailable",
    detail: "Add a workspace to enable worktree runs",
  },
  {
    id: "cloud",
    status: "unavailable",
    detail: "Cloud execution not configured",
  },
];

const fallbackEditorId =
  mockEditors.find((editor) => editor.detected)?.id ?? mockEditors[0]?.id;

const actionButtonClass =
  "rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300";

const formInputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-flare-300 focus:outline-none";

export function SettingsPage() {
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const { section } = useParams({ from: "/settings/$section" });
  const activeSection = settingsSections.find((item) => item.id === section);
  const activeSectionId = activeSection?.id ?? defaultSettingsSection;
  const activeSectionLabel = activeSection?.label ?? "General";
  const activeSectionDescription =
    activeSection?.description ??
    "Default editor destination and basic preferences.";
  const defaultOpenDestination = fallbackEditorId ?? "vscode";
  const initialSettings = useMemo(
    () => loadStoredSettings(defaultOpenDestination),
    [defaultOpenDestination],
  );
  const resolvedWorkspace = selectedWorkspace ?? workspaces[0]?.path ?? null;

  const [theme, setTheme] = useState<"system" | "light" | "dark">(
    initialSettings.theme,
  );
  const [openDestination, setOpenDestination] = useState(() => {
    if (
      mockEditors.some(
        (editor) => editor.id === initialSettings.openDestination,
      )
    ) {
      return initialSettings.openDestination;
    }
    return defaultOpenDestination;
  });
  const [followUpBehavior, setFollowUpBehavior] = useState<
    "append" | "new-thread" | "ask"
  >(initialSettings.followUpBehavior);
  const [compactComposer, setCompactComposer] = useState(
    initialSettings.compactComposer,
  );
  const [displayName, setDisplayName] = useState(initialSettings.displayName);
  const [responseTone, setResponseTone] = useState<
    "balanced" | "concise" | "verbose"
  >(initialSettings.responseTone);
  const [showTimestamps, setShowTimestamps] = useState(
    initialSettings.showTimestamps,
  );
  const [includeProjectOverrides, setIncludeProjectOverrides] = useState(
    initialSettings.includeProjectOverrides,
  );
  const [showExperimentalConfig, setShowExperimentalConfig] = useState(
    initialSettings.showExperimentalConfig,
  );
  const [mcpRequestTimeout, setMcpRequestTimeout] = useState(
    initialSettings.mcpRequestTimeout,
  );
  const [allowCommunitySkills, setAllowCommunitySkills] = useState(
    initialSettings.allowCommunitySkills,
  );
  const [autoRefreshSkills, setAutoRefreshSkills] = useState(
    initialSettings.autoRefreshSkills,
  );
  const [requireSkillReview, setRequireSkillReview] = useState(
    initialSettings.requireSkillReview,
  );
  const [gitAuthorName, setGitAuthorName] = useState(
    initialSettings.gitAuthorName,
  );
  const [gitAuthorEmail, setGitAuthorEmail] = useState(
    initialSettings.gitAuthorEmail,
  );
  const [defaultBranch, setDefaultBranch] = useState(
    initialSettings.defaultBranch,
  );
  const [autoSignCommits, setAutoSignCommits] = useState(
    initialSettings.autoSignCommits,
  );
  const [defaultEnvironment, setDefaultEnvironment] = useState<
    "local" | "worktree" | "cloud"
  >(initialSettings.defaultEnvironment);
  const [autoCreateWorktrees, setAutoCreateWorktrees] = useState(
    initialSettings.autoCreateWorktrees,
  );
  const [cloudRegion, setCloudRegion] = useState(initialSettings.cloudRegion);
  const [worktreeStrategy, setWorktreeStrategy] = useState<
    "clone" | "git_worktree"
  >(initialSettings.worktreeStrategy);
  const [worktreeBranchPrefix, setWorktreeBranchPrefix] = useState(
    initialSettings.worktreeBranchPrefix,
  );
  const [worktreeRetentionDays, setWorktreeRetentionDays] = useState(
    initialSettings.worktreeRetentionDays,
  );
  const [autoPruneMergedWorktrees, setAutoPruneMergedWorktrees] = useState(
    initialSettings.autoPruneMergedWorktrees,
  );
  const [archiveRetentionDays, setArchiveRetentionDays] = useState(
    initialSettings.archiveRetentionDays,
  );
  const [autoArchiveCompleted, setAutoArchiveCompleted] = useState(
    initialSettings.autoArchiveCompleted,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<MappedMcpServer[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<
    MappedProviderStatus[]
  >(fallbackProviderStatuses);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [archivedThreads, setArchivedThreads] = useState<
    Array<{ id: string; preview: string; updatedAt: number }>
  >([]);
  const [archivedThreadsLoading, setArchivedThreadsLoading] = useState(false);
  const [restoringArchivedThreadIds, setRestoringArchivedThreadIds] = useState<
    Set<string>
  >(() => new Set());
  const environmentProfileFallback = useMemo(
    () => ({
      executionMode: initialSettings.defaultEnvironment,
      cloudRegion: initialSettings.cloudRegion,
      autoCreateWorktrees: initialSettings.autoCreateWorktrees,
    }),
    [
      initialSettings.autoCreateWorktrees,
      initialSettings.cloudRegion,
      initialSettings.defaultEnvironment,
    ],
  );
  const loadedEnvironmentProfiles = useMemo(
    () =>
      loadStoredEnvironmentProfiles({
        workspaces,
        preferredWorkspacePath: selectedWorkspace,
        fallback: environmentProfileFallback,
      }),
    [environmentProfileFallback, selectedWorkspace, workspaces],
  );
  const [environmentProfiles, setEnvironmentProfiles] = useState<
    EnvironmentProfile[]
  >(loadedEnvironmentProfiles.profiles);
  const [activeEnvironmentProfileId, setActiveEnvironmentProfileId] = useState<
    string | null
  >(loadedEnvironmentProfiles.activeProfileId);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setSaveMessage(null);
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setActionMessage(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  useEffect(() => {
    setEnvironmentProfiles((current) => {
      const currentById = new Map(
        current.map((profile) => [profile.id, profile]),
      );
      return loadedEnvironmentProfiles.profiles.map((profile) => {
        const existing = currentById.get(profile.id);
        if (!existing) {
          return profile;
        }
        return {
          ...profile,
          name: existing.name,
          executionMode: existing.executionMode,
          cloudRegion: existing.cloudRegion,
          autoCreateWorktrees: existing.autoCreateWorktrees,
        };
      });
    });
    setActiveEnvironmentProfileId((current) => {
      if (
        current &&
        loadedEnvironmentProfiles.profiles.some(
          (profile) => profile.id === current,
        )
      ) {
        return current;
      }
      return loadedEnvironmentProfiles.activeProfileId;
    });
  }, [
    loadedEnvironmentProfiles.activeProfileId,
    loadedEnvironmentProfiles.profiles,
  ]);

  useEffect(() => {
    const preferredId = environmentProfileIdFromWorkspace(selectedWorkspace);
    if (!preferredId) {
      return;
    }
    if (!environmentProfiles.some((profile) => profile.id === preferredId)) {
      return;
    }
    setActiveEnvironmentProfileId(preferredId);
  }, [environmentProfiles, selectedWorkspace]);

  const runAction = useCallback(
    async (
      action: () => Promise<string> | string,
      fallbackErrorMessage: string,
    ) => {
      setActionError(null);
      try {
        const message = await action();
        setActionMessage(message);
      } catch (error) {
        setActionMessage(null);
        setActionError(
          error instanceof Error ? error.message : fallbackErrorMessage,
        );
      }
    },
    [],
  );

  const buildSnapshot = (): StoredSettingsSnapshot => ({
    theme,
    openDestination,
    followUpBehavior,
    compactComposer,
    displayName,
    responseTone,
    showTimestamps,
    includeProjectOverrides,
    showExperimentalConfig,
    mcpRequestTimeout,
    allowCommunitySkills,
    autoRefreshSkills,
    requireSkillReview,
    gitAuthorName,
    gitAuthorEmail,
    defaultBranch,
    autoSignCommits,
    defaultEnvironment,
    autoCreateWorktrees,
    cloudRegion,
    worktreeStrategy,
    worktreeBranchPrefix,
    worktreeRetentionDays,
    autoPruneMergedWorktrees,
    archiveRetentionDays,
    autoArchiveCompleted,
  });

  const handleSave = (
    targetSection: SettingsSectionId,
    overrides: Partial<StoredSettingsSnapshot> = {},
  ) => {
    storeSettings({
      ...buildSnapshot(),
      ...overrides,
    });
    const label =
      settingsSections.find((item) => item.id === targetSection)?.label ??
      "Settings";
    setSaveMessage(`${label} settings saved.`);
  };

  const selectedEnvironmentProfile = useMemo(() => {
    if (!environmentProfiles.length) {
      return null;
    }
    if (!activeEnvironmentProfileId) {
      return environmentProfiles[0];
    }
    return (
      environmentProfiles.find(
        (profile) => profile.id === activeEnvironmentProfileId,
      ) ?? environmentProfiles[0]
    );
  }, [activeEnvironmentProfileId, environmentProfiles]);

  const updateSelectedEnvironmentProfile = useCallback(
    (
      updater: (
        profile: EnvironmentProfile,
      ) => Pick<
        EnvironmentProfile,
        "name" | "executionMode" | "cloudRegion" | "autoCreateWorktrees"
      >,
    ) => {
      if (!activeEnvironmentProfileId) {
        return;
      }
      setEnvironmentProfiles((current) =>
        current.map((profile) => {
          if (profile.id !== activeEnvironmentProfileId) {
            return profile;
          }
          return {
            ...profile,
            ...updater(profile),
          };
        }),
      );
    },
    [activeEnvironmentProfileId],
  );

  const handleSaveEnvironmentSettings = () => {
    const profile = selectedEnvironmentProfile;
    storeEnvironmentProfiles({
      activeProfileId: profile?.id ?? activeEnvironmentProfileId,
      profiles: environmentProfiles,
    });
    if (profile?.workspacePath) {
      setSelectedWorkspace(profile.workspacePath);
    }
    if (profile) {
      setDefaultEnvironment(profile.executionMode);
      setCloudRegion(profile.cloudRegion);
      setAutoCreateWorktrees(profile.autoCreateWorktrees);
    }
    handleSave("environments", {
      defaultEnvironment: profile?.executionMode ?? defaultEnvironment,
      cloudRegion: profile?.cloudRegion ?? cloudRegion,
      autoCreateWorktrees: profile?.autoCreateWorktrees ?? autoCreateWorktrees,
    });
  };

  const inferredConfigPath = useMemo(() => {
    if (typeof navigator === "undefined") {
      return "~/.codex/config.toml";
    }
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("windows")) {
      return "%USERPROFILE%\\.codex\\config.toml";
    }
    return "~/.codex/config.toml";
  }, []);

  const refreshMcpServers = useCallback(async () => {
    setMcpLoading(true);
    try {
      const [config, runtimeStatuses, authStatus] = await Promise.all([
        loadMergedConfig(resolvedWorkspace),
        loadMcpServerStatuses().catch(() => []),
        loadAuthStatus().catch(() => ({
          status: "unknown",
          requiresOpenaiAuth: null,
        })),
      ]);
      const runtimeStatusById = new Map(
        runtimeStatuses.map((status) => [status.id, status.status]),
      );
      let parsedServers = mcpServersFromConfig(config).map((server) => {
        const runtimeStatus = runtimeStatusById.get(server.id);
        if (!runtimeStatus) {
          return server;
        }
        return {
          ...server,
          status: runtimeStatus,
        } satisfies MappedMcpServer;
      });
      if (!parsedServers.length && runtimeStatuses.length) {
        parsedServers = runtimeStatuses.map((status) => ({
          id: status.id,
          name: status.id,
          endpoint: "mcp://unknown",
          status: status.status,
        }));
      }
      setMcpServers(parsedServers);
      const providers = providersFromConfig(config).map((provider) => {
        if (provider.id !== "local") {
          return provider;
        }
        const authLabel =
          authStatus.status === "authenticated" ||
          authStatus.status === "logged_in"
            ? "Authenticated"
            : authStatus.status === "unknown"
              ? provider.detail
              : `Auth: ${authStatus.status}`;
        return {
          ...provider,
          detail: authLabel,
        };
      });
      setProviderStatuses(providers);
      return parsedServers.length
        ? `Reloaded ${parsedServers.length} MCP server(s).`
        : "No MCP servers configured.";
    } finally {
      setMcpLoading(false);
    }
  }, [resolvedWorkspace]);

  const handleOpenConfigFile = () =>
    runAction(async () => {
      await navigator.clipboard.writeText(inferredConfigPath);
      return `Copied config path: ${inferredConfigPath}`;
    }, "Failed to copy config path.");

  const handleValidateConfig = () =>
    runAction(async () => {
      const result = await validateConfig(resolvedWorkspace);
      if (!result.valid) {
        throw new Error(result.errors.join("; ") || "Config is invalid.");
      }
      return `Config loaded successfully (${result.keys} top-level keys).`;
    }, "Config validation failed.");

  const handleAddMcpServer = () =>
    runAction(() => {
      const id = window.prompt("MCP server ID (example: github)");
      if (!id?.trim()) {
        throw new Error("MCP server ID is required.");
      }
      const endpoint =
        window.prompt(
          "MCP endpoint or command",
          `mcp://${id.trim().toLowerCase()}`,
        ) ?? "";
      if (!endpoint.trim()) {
        throw new Error("MCP endpoint is required.");
      }
      const server: MappedMcpServer = {
        id: id.trim(),
        name: id.trim(),
        endpoint: endpoint.trim(),
        status: "connected",
      };
      setMcpServers((current) => {
        const deduped = current.filter((entry) => entry.id !== server.id);
        return [server, ...deduped];
      });
      return `Added MCP server ${server.id} (session-only).`;
    }, "Failed to add MCP server.");

  const handleReloadMcpServers = () =>
    runAction(
      () => refreshMcpServers(),
      "Failed to reload MCP server connections.",
    );

  const handleRunPruneNow = () =>
    runAction(async () => {
      if (!resolvedWorkspace) {
        throw new Error("Select a workspace before pruning worktrees.");
      }
      if (!isTauri()) {
        throw new Error("Worktree prune is available in the desktop app.");
      }
      const result = await execCommand({
        command: ["git", "worktree", "prune", "--verbose"],
        cwd: resolvedWorkspace,
      });
      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr.trim() || result.stdout.trim() || "Prune failed.",
        );
      }
      const output = result.stdout.trim();
      return output || "Worktree prune finished successfully.";
    }, "Failed to prune worktrees.");

  const handleLoadArchivedThreads = () =>
    runAction(async () => {
      setArchivedThreadsLoading(true);
      try {
        const response = await listThreads({
          archived: true,
          limit: 100,
        });
        setArchivedThreads(
          response.data.map((thread) => ({
            id: thread.id,
            preview: thread.preview || "Untitled thread",
            updatedAt: thread.updatedAt,
          })),
        );
        return response.data.length
          ? `Loaded ${response.data.length} archived thread(s).`
          : "No archived threads found.";
      } finally {
        setArchivedThreadsLoading(false);
      }
    }, "Failed to load archived threads.");

  const handleRestoreAllArchived = () =>
    runAction(async () => {
      setArchivedThreadsLoading(true);
      try {
        const response = await listThreads({
          archived: true,
          limit: 100,
        });
        if (!response.data.length) {
          setArchivedThreads([]);
          return "No archived threads to restore.";
        }
        await Promise.all(
          response.data.map((thread) => unarchiveThread(thread.id)),
        );
        setArchivedThreads([]);
        return `Restored ${response.data.length} archived thread(s).`;
      } finally {
        setArchivedThreadsLoading(false);
      }
    }, "Failed to restore archived threads.");

  const handleRestoreArchivedThread = (threadId: string) =>
    runAction(async () => {
      setRestoringArchivedThreadIds((current) =>
        new Set(current).add(threadId),
      );
      try {
        await unarchiveThread(threadId);
        setArchivedThreads((current) =>
          current.filter((thread) => thread.id !== threadId),
        );
        return "Archived thread restored.";
      } finally {
        setRestoringArchivedThreadIds((current) => {
          const next = new Set(current);
          next.delete(threadId);
          return next;
        });
      }
    }, "Failed to restore archived thread.");

  useEffect(() => {
    if (
      activeSectionId !== "mcp-servers" &&
      activeSectionId !== "configuration" &&
      activeSectionId !== "environments"
    ) {
      return;
    }
    void refreshMcpServers();
  }, [activeSectionId, refreshMcpServers]);

  const renderFormForSection = (targetSection: SettingsSectionId) => {
    switch (targetSection) {
      case "general":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              General
            </p>
            <h2 className="font-display text-xl">Core experience defaults</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-theme"
                >
                  Theme
                </label>
                <select
                  id="settings-theme"
                  className={formInputClass}
                  value={theme}
                  onChange={(event) =>
                    setTheme(event.target.value as typeof theme)
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-open-destination"
                >
                  Default open destination
                </label>
                <select
                  id="settings-open-destination"
                  className={formInputClass}
                  value={openDestination}
                  onChange={(event) => setOpenDestination(event.target.value)}
                >
                  {mockEditors.map((editor) => (
                    <option key={editor.id} value={editor.id}>
                      {editor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-follow-up"
                >
                  Follow-up behavior
                </label>
                <select
                  id="settings-follow-up"
                  className={formInputClass}
                  value={followUpBehavior}
                  onChange={(event) =>
                    setFollowUpBehavior(
                      event.target.value as typeof followUpBehavior,
                    )
                  }
                >
                  <option value="append">Append in current thread</option>
                  <option value="new-thread">
                    Start a new thread after each run
                  </option>
                  <option value="ask">Ask each time</option>
                </select>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={compactComposer}
                onChange={(event) => setCompactComposer(event.target.checked)}
              />
              Use compact composer controls
            </label>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={() => handleSave("general")}
              >
                Save general settings
              </button>
            </div>
          </section>
        );
      case "configuration":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Configuration
            </p>
            <h2 className="font-display text-xl">Unified CLI configuration</h2>
            <p className="mt-2 text-sm text-ink-300">
              Review merged `config.toml` values for this workspace and global
              defaults.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-300">
              config.toml preview will live here.
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleOpenConfigFile();
                }}
              >
                Open config file
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleValidateConfig();
                }}
              >
                Validate TOML
              </button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-ink-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeProjectOverrides}
                  onChange={(event) =>
                    setIncludeProjectOverrides(event.target.checked)
                  }
                />
                Include project overrides
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showExperimentalConfig}
                  onChange={(event) =>
                    setShowExperimentalConfig(event.target.checked)
                  }
                />
                Show experimental keys
              </label>
            </div>
            <div className="mt-5 space-y-3">
              <h3 className="font-display text-base text-ink-100">
                Detected tools
              </h3>
              {mockEditors.map((editor) => (
                <div
                  key={editor.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span>{editor.name}</span>
                  <span className="text-xs text-ink-400">
                    {editor.detected ? "Detected" : "Not found"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              <h3 className="font-display text-base text-ink-100">
                Execution backends
              </h3>
              {providerStatuses.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span>{provider.id}</span>
                  <span className="text-xs text-ink-400">
                    {provider.detail}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={() => handleSave("configuration")}
              >
                Save configuration
              </button>
            </div>
          </section>
        );
      case "personalization":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Personalization
            </p>
            <h2 className="font-display text-xl">Assistant presentation</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-display-name"
                >
                  Display name
                </label>
                <input
                  id="settings-display-name"
                  className={formInputClass}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-response-tone"
                >
                  Response tone
                </label>
                <select
                  id="settings-response-tone"
                  className={formInputClass}
                  value={responseTone}
                  onChange={(event) =>
                    setResponseTone(event.target.value as typeof responseTone)
                  }
                >
                  <option value="balanced">Balanced</option>
                  <option value="concise">Concise</option>
                  <option value="verbose">Verbose</option>
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-ink-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(event) => setShowTimestamps(event.target.checked)}
                />
                Show message timestamps
              </label>
            </div>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={() => handleSave("personalization")}
              >
                Save personalization
              </button>
            </div>
          </section>
        );
      case "mcp-servers":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              MCP servers
            </p>
            <h2 className="font-display text-xl">Tool endpoints</h2>
            <div className="mt-4 space-y-2">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-ink-100">{server.name}</p>
                    <p className="text-xs text-ink-500">{server.endpoint}</p>
                  </div>
                  <span className="text-xs text-ink-300">{server.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 max-w-sm space-y-2">
              <label
                className="text-xs uppercase tracking-[0.2em] text-ink-500"
                htmlFor="settings-mcp-timeout"
              >
                Request timeout (seconds)
              </label>
              <input
                id="settings-mcp-timeout"
                className={formInputClass}
                value={mcpRequestTimeout}
                onChange={(event) => setMcpRequestTimeout(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleAddMcpServer();
                }}
              >
                + Add MCP server
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleReloadMcpServers();
                }}
                disabled={mcpLoading}
              >
                {mcpLoading ? "Reloading…" : "Reload connections"}
              </button>
              <button
                className={actionButtonClass}
                onClick={() => handleSave("mcp-servers")}
              >
                Save MCP settings
              </button>
            </div>
          </section>
        );
      case "skills":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Skills
            </p>
            <h2 className="font-display text-xl">
              Skill installation defaults
            </h2>
            <div className="mt-4 space-y-2 text-xs text-ink-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowCommunitySkills}
                  onChange={(event) =>
                    setAllowCommunitySkills(event.target.checked)
                  }
                />
                Allow community skills
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefreshSkills}
                  onChange={(event) =>
                    setAutoRefreshSkills(event.target.checked)
                  }
                />
                Refresh skill catalog on launch
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireSkillReview}
                  onChange={(event) =>
                    setRequireSkillReview(event.target.checked)
                  }
                />
                Require permission review before install
              </label>
            </div>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={() => handleSave("skills")}
              >
                Save skill settings
              </button>
            </div>
          </section>
        );
      case "git":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Git
            </p>
            <h2 className="font-display text-xl">Commit and branch defaults</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-git-author-name"
                >
                  Author name
                </label>
                <input
                  id="settings-git-author-name"
                  className={formInputClass}
                  value={gitAuthorName}
                  onChange={(event) => setGitAuthorName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-git-author-email"
                >
                  Author email
                </label>
                <input
                  id="settings-git-author-email"
                  className={formInputClass}
                  value={gitAuthorEmail}
                  onChange={(event) => setGitAuthorEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-git-base-branch"
                >
                  Default base branch
                </label>
                <input
                  id="settings-git-base-branch"
                  className={formInputClass}
                  value={defaultBranch}
                  onChange={(event) => setDefaultBranch(event.target.value)}
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={autoSignCommits}
                onChange={(event) => setAutoSignCommits(event.target.checked)}
              />
              Sign commits automatically
            </label>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={() => handleSave("git")}
              >
                Save git settings
              </button>
            </div>
          </section>
        );
      case "environments":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Environments
            </p>
            <h2 className="font-display text-xl">Environment profiles</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  Available environments
                </p>
                <div className="mt-3 space-y-2">
                  {environmentProfiles.map((profile) => {
                    const isActive =
                      profile.id === selectedEnvironmentProfile?.id;
                    return (
                      <button
                        key={profile.id}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          isActive
                            ? "border-flare-300 bg-flare-400/10 text-ink-50"
                            : "border-white/10 text-ink-300 hover:border-flare-300"
                        }`}
                        onClick={() => {
                          setActiveEnvironmentProfileId(profile.id);
                          if (profile.workspacePath) {
                            setSelectedWorkspace(profile.workspacePath);
                          }
                        }}
                      >
                        <p className="truncate text-sm">{profile.name}</p>
                        <p className="truncate text-xs text-ink-500">
                          {profile.workspacePath || "No workspace linked"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                {selectedEnvironmentProfile ? (
                  <>
                    <div className="space-y-2">
                      <label
                        className="text-xs uppercase tracking-[0.2em] text-ink-500"
                        htmlFor="settings-environment-name"
                      >
                        Name
                      </label>
                      <input
                        id="settings-environment-name"
                        className={formInputClass}
                        value={selectedEnvironmentProfile.name}
                        onChange={(event) =>
                          updateSelectedEnvironmentProfile((profile) => ({
                            ...profile,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-xs uppercase tracking-[0.2em] text-ink-500"
                        htmlFor="settings-environment-path"
                      >
                        Workspace path
                      </label>
                      <input
                        id="settings-environment-path"
                        className={formInputClass}
                        value={
                          selectedEnvironmentProfile.workspacePath ||
                          "No workspace linked"
                        }
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                        Execution mode
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(["local", "worktree", "cloud"] as const).map(
                          (mode) => (
                            <button
                              key={mode}
                              className={`rounded-full border px-3 py-1 text-xs transition hover:border-flare-300 ${
                                selectedEnvironmentProfile.executionMode ===
                                mode
                                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                                  : "border-white/10 text-ink-300"
                              }`}
                              onClick={() =>
                                updateSelectedEnvironmentProfile((profile) => ({
                                  ...profile,
                                  executionMode: mode,
                                }))
                              }
                            >
                              {mode}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="max-w-sm space-y-2">
                      <label
                        className="text-xs uppercase tracking-[0.2em] text-ink-500"
                        htmlFor="settings-environment-cloud-region"
                      >
                        Cloud region
                      </label>
                      <select
                        id="settings-environment-cloud-region"
                        className={formInputClass}
                        value={selectedEnvironmentProfile.cloudRegion}
                        onChange={(event) =>
                          updateSelectedEnvironmentProfile((profile) => ({
                            ...profile,
                            cloudRegion: event.target.value,
                          }))
                        }
                      >
                        <option value="us-east">US East</option>
                        <option value="us-west">US West</option>
                        <option value="eu-central">EU Central</option>
                      </select>
                    </div>
                    <div className="space-y-2 text-xs text-ink-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            selectedEnvironmentProfile.autoCreateWorktrees
                          }
                          onChange={(event) =>
                            updateSelectedEnvironmentProfile((profile) => ({
                              ...profile,
                              autoCreateWorktrees: event.target.checked,
                            }))
                          }
                        />
                        Auto-create worktrees for this environment
                      </label>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-300">
                    Add a workspace to manage environment settings.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm">
              {providerStatuses.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span>{provider.id}</span>
                  <span className="text-xs text-ink-400">
                    {provider.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                className={actionButtonClass}
                onClick={handleSaveEnvironmentSettings}
              >
                Save environment settings
              </button>
            </div>
          </section>
        );
      case "worktrees":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Worktrees
            </p>
            <h2 className="font-display text-xl">Worktree lifecycle</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-worktree-strategy"
                >
                  Strategy
                </label>
                <select
                  id="settings-worktree-strategy"
                  className={formInputClass}
                  value={worktreeStrategy}
                  onChange={(event) =>
                    setWorktreeStrategy(
                      event.target.value as typeof worktreeStrategy,
                    )
                  }
                >
                  <option value="git_worktree">git worktree</option>
                  <option value="clone">Clone workspace</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-worktree-prefix"
                >
                  Branch prefix
                </label>
                <input
                  id="settings-worktree-prefix"
                  className={formInputClass}
                  value={worktreeBranchPrefix}
                  onChange={(event) =>
                    setWorktreeBranchPrefix(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor="settings-worktree-retention"
                >
                  Keep merged worktrees (days)
                </label>
                <input
                  id="settings-worktree-retention"
                  className={formInputClass}
                  value={worktreeRetentionDays}
                  onChange={(event) =>
                    setWorktreeRetentionDays(event.target.value)
                  }
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={autoPruneMergedWorktrees}
                onChange={(event) =>
                  setAutoPruneMergedWorktrees(event.target.checked)
                }
              />
              Auto-prune merged worktrees
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleRunPruneNow();
                }}
              >
                Run prune now
              </button>
              <button
                className={actionButtonClass}
                onClick={() => handleSave("worktrees")}
              >
                Save worktree settings
              </button>
            </div>
          </section>
        );
      case "archived-threads":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Archived threads
            </p>
            <h2 className="font-display text-xl">Archive retention</h2>
            <div className="mt-4 max-w-sm space-y-2">
              <label
                className="text-xs uppercase tracking-[0.2em] text-ink-500"
                htmlFor="settings-archive-retention"
              >
                Retention (days)
              </label>
              <input
                id="settings-archive-retention"
                className={formInputClass}
                value={archiveRetentionDays}
                onChange={(event) =>
                  setArchiveRetentionDays(event.target.value)
                }
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={autoArchiveCompleted}
                onChange={(event) =>
                  setAutoArchiveCompleted(event.target.checked)
                }
              />
              Auto-archive completed threads
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleLoadArchivedThreads();
                }}
                disabled={archivedThreadsLoading}
              >
                Open archived threads
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleRestoreAllArchived();
                }}
                disabled={archivedThreadsLoading}
              >
                Restore all
              </button>
              <button
                className={actionButtonClass}
                onClick={() => handleSave("archived-threads")}
              >
                Save archive settings
              </button>
            </div>
            {archivedThreads.length ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  Loaded archived threads
                </p>
                <div className="mt-2 space-y-2 text-xs text-ink-300">
                  {archivedThreads.slice(0, 8).map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{thread.preview}</p>
                        <p className="text-[0.65rem] text-ink-500">
                          {new Date(thread.updatedAt * 1000).toLocaleString()}
                        </p>
                      </div>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          void handleRestoreArchivedThread(thread.id);
                        }}
                        disabled={restoringArchivedThreadIds.has(thread.id)}
                      >
                        {restoringArchivedThreadIds.has(thread.id)
                          ? "Restoring…"
                          : "Restore"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-white/10 bg-ink-900/50 p-3 shadow-card">
        <p className="px-2 text-xs uppercase tracking-[0.3em] text-ink-400">
          Settings
        </p>
        <nav className="mt-3 space-y-1 text-sm">
          {settingsSections.map((item) => {
            const isActive = item.id === activeSectionId;
            return (
              <Link
                key={item.id}
                to="/settings/$section"
                params={{ section: item.id }}
                className={`block rounded-xl px-3 py-2 transition ${
                  isActive
                    ? "bg-white/10 text-ink-50"
                    : "text-ink-300 hover:bg-white/5 hover:text-ink-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
          <h1 className="font-display text-2xl">{activeSectionLabel}</h1>
          <p className="mt-2 text-sm text-ink-300">
            {activeSectionDescription}
          </p>
          {saveMessage ? (
            <p className="mt-2 text-xs text-emerald-300">{saveMessage}</p>
          ) : null}
          {actionMessage ? (
            <p className="mt-2 text-xs text-emerald-300">{actionMessage}</p>
          ) : null}
          {actionError ? (
            <p className="mt-2 text-xs text-rose-300">{actionError}</p>
          ) : null}
        </section>
        {renderFormForSection(activeSectionId)}
      </div>
    </div>
  );
}
