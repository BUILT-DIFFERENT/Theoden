import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AccountActionCancelledError,
  runAccountAction as performAccountAction,
} from "@/app/services/cli/accountActions";
import {
  readAccountRateLimits,
  type AccountRateLimitSnapshot,
} from "@/app/services/cli/accountUsage";
import { subscribeAppServerNotifications } from "@/app/services/cli/appServerEventHub";
import { execCommand } from "@/app/services/cli/commands";
import {
  loadAuthStatus,
  loadConfigSnapshot,
  loadMcpServerStatuses,
  mapConfigWriteErrorMessage,
  mcpServersFromConfig,
  providersFromConfig,
  readConfigRequirements,
  reloadMcpServerConfig,
  startMcpServerOauthLogin,
  validateConfig,
  writeConfigValue,
  type ConfigReadSnapshot,
  type ConfigValidationResult,
  type MappedMcpServer,
  type MappedProviderStatus,
} from "@/app/services/cli/config";
import { listThreads, unarchiveThread } from "@/app/services/cli/threads";
import { useAccount } from "@/app/services/cli/useAccount";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { openPathInExplorer } from "@/app/services/desktop/open";
import {
  listWorktrees,
  removeWorktree,
  type WorktreeInventoryRow,
} from "@/app/services/git/worktrees";
import { openExternalUrl } from "@/app/services/host/external";
import {
  checkForHostUpdates,
  getBridgeBuildFlavor,
  getHostUpdateState,
  subscribeHostUpdateState,
  type HostUpdateState,
} from "@/app/services/host/runtime";
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

type McpServerTransport = "url" | "command";

interface McpServerFormState {
  originalId: string | null;
  id: string;
  transport: McpServerTransport;
  endpointValue: string;
  enabled: boolean;
}

function environmentProfilesMatch(
  current: EnvironmentProfile[],
  next: EnvironmentProfile[],
) {
  if (current === next) {
    return true;
  }
  if (current.length !== next.length) {
    return false;
  }
  return current.every((profile, index) => {
    const candidate = next[index];
    return (
      profile.id === candidate.id &&
      profile.name === candidate.name &&
      profile.workspacePath === candidate.workspacePath &&
      profile.executionMode === candidate.executionMode &&
      profile.cloudRegion === candidate.cloudRegion &&
      profile.autoCreateWorktrees === candidate.autoCreateWorktrees
    );
  });
}

function codexHomePathForPlatform() {
  if (typeof navigator === "undefined") {
    return "~/.codex";
  }
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("windows")) {
    return "%USERPROFILE%\\.codex";
  }
  return "~/.codex";
}

function formatRateLimitResetAt(value: number | null) {
  if (!value) {
    return "Unknown";
  }
  return new Date(value * 1000).toLocaleString();
}

function mcpServerMapFromConfig(config: Record<string, unknown>) {
  const mcpServersRaw =
    (typeof config.mcp_servers === "object" &&
    config.mcp_servers &&
    !Array.isArray(config.mcp_servers)
      ? (config.mcp_servers as Record<string, unknown>)
      : null) ??
    (typeof config.mcpServers === "object" &&
    config.mcpServers &&
    !Array.isArray(config.mcpServers)
      ? (config.mcpServers as Record<string, unknown>)
      : null);
  const output: Record<string, Record<string, unknown>> = {};
  if (!mcpServersRaw) {
    return output;
  }
  Object.entries(mcpServersRaw).forEach(([id, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    output[id] = value as Record<string, unknown>;
  });
  return output;
}

function createMcpServerFormState(
  server?: MappedMcpServer | null,
): McpServerFormState {
  if (!server) {
    return {
      originalId: null,
      id: "",
      transport: "url",
      endpointValue: "",
      enabled: true,
    };
  }
  const config = server.config ?? {};
  const transport: McpServerTransport =
    typeof config.command === "string" && config.command.trim().length
      ? "command"
      : "url";
  const endpointValue =
    transport === "command"
      ? typeof config.command === "string"
        ? config.command
        : server.endpoint
      : typeof config.url === "string"
        ? config.url
        : typeof config.endpoint === "string"
          ? config.endpoint
          : server.endpoint;
  return {
    originalId: server.id,
    id: server.id,
    transport,
    endpointValue,
    enabled: server.enabled,
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const {
    account,
    isLoading: accountLoading,
    refresh: refreshAccount,
  } = useAccount();
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
  const [accountAction, setAccountAction] = useState<
    "login-chatgpt" | "login-api-key" | "logout" | null
  >(null);
  const [rateLimits, setRateLimits] = useState<AccountRateLimitSnapshot | null>(
    null,
  );
  const [rateLimitsLoading, setRateLimitsLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<MappedMcpServer[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<
    MappedProviderStatus[]
  >(fallbackProviderStatuses);
  const [hostUpdateEventState, setHostUpdateEventState] =
    useState<HostUpdateState | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpMutating, setMcpMutating] = useState(false);
  const [mcpFormState, setMcpFormState] = useState<McpServerFormState>(
    createMcpServerFormState(),
  );
  const [mcpFormOpen, setMcpFormOpen] = useState(false);
  const [configSnapshot, setConfigSnapshot] =
    useState<ConfigReadSnapshot | null>(null);
  const [configValidationResult, setConfigValidationResult] =
    useState<ConfigValidationResult | null>(null);
  const [configRequirements, setConfigRequirements] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [archivedThreads, setArchivedThreads] = useState<
    Array<{ id: string; preview: string; updatedAt: number }>
  >([]);
  const [archivedThreadsLoading, setArchivedThreadsLoading] = useState(false);
  const [restoringArchivedThreadIds, setRestoringArchivedThreadIds] = useState<
    Set<string>
  >(() => new Set());
  const [worktreeRows, setWorktreeRows] = useState<WorktreeInventoryRow[]>([]);
  const [worktreeRowsLoading, setWorktreeRowsLoading] = useState(false);
  const [worktreeRowsError, setWorktreeRowsError] = useState<string | null>(
    null,
  );
  const [removingWorktreePaths, setRemovingWorktreePaths] = useState<
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
  const configPreviewText = useMemo(
    () =>
      configSnapshot
        ? JSON.stringify(configSnapshot.config, null, 2)
        : "Loading merged config…",
    [configSnapshot],
  );
  const configErrors = configValidationResult?.errors ?? [];
  const configWarnings = configValidationResult?.warnings ?? [];

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
    let unlisten: (() => void) | null = null;
    void subscribeHostUpdateState((payload) => {
      setHostUpdateEventState(payload);
      void queryClient.setQueryData(["host", "update-state"], payload);
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [queryClient]);

  useEffect(() => {
    setEnvironmentProfiles((current) => {
      const currentById = new Map(
        current.map((profile) => [profile.id, profile]),
      );
      const nextProfiles = loadedEnvironmentProfiles.profiles.map((profile) => {
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
      return environmentProfilesMatch(current, nextProfiles)
        ? current
        : nextProfiles;
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
  const codexHomePath = useMemo(() => codexHomePathForPlatform(), []);
  const inferredSqlitePath = `${codexHomePath}${
    codexHomePath.endsWith("\\")
      ? ""
      : codexHomePath.includes("\\")
        ? "\\"
        : "/"
  }sqlite`;
  const inferredAutomationsPath = `${codexHomePath}${
    codexHomePath.endsWith("\\")
      ? ""
      : codexHomePath.includes("\\")
        ? "\\"
        : "/"
  }automations`;
  const hostUpdateStateQuery = useQuery({
    queryKey: ["host", "update-state"],
    queryFn: getHostUpdateState,
    refetchOnWindowFocus: true,
  });
  const hostBuildFlavorQuery = useQuery({
    queryKey: ["host", "build-flavor"],
    queryFn: getBridgeBuildFlavor,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const refreshRateLimits = useCallback(async () => {
    setRateLimitsLoading(true);
    try {
      const snapshot = await readAccountRateLimits();
      setRateLimits(snapshot);
      return snapshot;
    } finally {
      setRateLimitsLoading(false);
    }
  }, []);

  const loadWorktreeRows = useCallback(async () => {
    if (!resolvedWorkspace) {
      setWorktreeRows([]);
      setWorktreeRowsError("Select a workspace to inspect worktrees.");
      return [];
    }
    setWorktreeRowsLoading(true);
    setWorktreeRowsError(null);
    try {
      const rows = await listWorktrees(resolvedWorkspace);
      setWorktreeRows(rows);
      return rows;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list worktrees.";
      setWorktreeRowsError(message);
      throw error;
    } finally {
      setWorktreeRowsLoading(false);
    }
  }, [resolvedWorkspace]);

  const refreshMcpServers = useCallback(async () => {
    setMcpLoading(true);
    try {
      const [snapshot, runtimeStatuses, authStatus] = await Promise.all([
        loadConfigSnapshot(resolvedWorkspace),
        loadMcpServerStatuses().catch(() => []),
        loadAuthStatus().catch(() => ({
          status: "unknown",
          requiresOpenaiAuth: null,
        })),
      ]);
      const config = snapshot.config;
      setConfigSnapshot(snapshot);
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
          enabled: status.status !== "disabled",
          status: status.status,
          config: {},
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

  const refreshConfigDiagnostics = useCallback(async () => {
    const [snapshot, validation, requirements] = await Promise.all([
      loadConfigSnapshot(resolvedWorkspace),
      validateConfig(resolvedWorkspace),
      readConfigRequirements().catch(() => null),
    ]);
    setConfigSnapshot(snapshot);
    setConfigValidationResult(validation);
    setConfigRequirements(requirements);
    return { snapshot, validation, requirements };
  }, [resolvedWorkspace]);

  const handleOpenConfigFile = () =>
    runAction(async () => {
      await navigator.clipboard.writeText(inferredConfigPath);
      return `Copied config path: ${inferredConfigPath}`;
    }, "Failed to copy config path.");

  const handleOpenPathInExplorer = (path: string, label: string) =>
    runAction(async () => {
      if (!isTauri()) {
        throw new Error(
          "Open in file explorer is available in the desktop app.",
        );
      }
      await openPathInExplorer(path);
      return `Opened ${label}.`;
    }, `Failed to open ${label}.`);

  const handleRunAccountAction = (
    action: "login-chatgpt" | "login-api-key" | "logout",
  ) =>
    runAction(async () => {
      setAccountAction(action);
      try {
        const message = await performAccountAction(action, {
          promptApiKey: () => window.prompt("Enter OpenAI API key"),
          openExternal: (url) => {
            void openExternalUrl(url);
          },
          refreshAccount,
        });
        return message;
      } catch (error) {
        if (error instanceof AccountActionCancelledError) {
          return "Account action cancelled.";
        }
        throw error;
      } finally {
        setAccountAction(null);
      }
    }, "Account action failed.");

  const handleValidateConfig = () =>
    runAction(async () => {
      const { validation } = await refreshConfigDiagnostics();
      const result = validation;
      if (!result.valid) {
        throw new Error(
          result.errors
            .map((entry) => `${entry.key}: ${entry.message}`)
            .join("; ") || "Config is invalid.",
        );
      }
      return `Config loaded successfully (${result.keys.length} keys).`;
    }, "Config validation failed.");

  const handleReloadMcpServers = () =>
    runAction(
      () => refreshMcpServers(),
      "Failed to reload MCP server connections.",
    );

  const persistMcpServerMap = useCallback(
    async (
      nextMap: Record<string, Record<string, unknown>>,
      successMessage: string,
    ) => {
      setMcpMutating(true);
      try {
        const snapshot = await loadConfigSnapshot(resolvedWorkspace);
        await writeConfigValue({
          keyPath: "mcp_servers",
          value: nextMap,
          mergeStrategy: "replace",
          filePath: snapshot.writeTarget.filePath,
          expectedVersion: snapshot.writeTarget.expectedVersion,
        });
        await reloadMcpServerConfig();
        await Promise.all([refreshMcpServers(), refreshConfigDiagnostics()]);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["settings", "mcp"] }),
          queryClient.invalidateQueries({ queryKey: ["providers", "status"] }),
        ]);
        return successMessage;
      } catch (error) {
        throw new Error(mapConfigWriteErrorMessage(error));
      } finally {
        setMcpMutating(false);
      }
    },
    [
      queryClient,
      refreshConfigDiagnostics,
      refreshMcpServers,
      resolvedWorkspace,
    ],
  );

  const openCreateMcpForm = () => {
    setMcpFormState(createMcpServerFormState());
    setMcpFormOpen(true);
  };

  const openEditMcpForm = (server: MappedMcpServer) => {
    setMcpFormState(createMcpServerFormState(server));
    setMcpFormOpen(true);
  };

  const handleSubmitMcpForm = () =>
    runAction(async () => {
      const nextId = mcpFormState.id.trim();
      const endpoint = mcpFormState.endpointValue.trim();
      if (!nextId) {
        throw new Error("MCP server ID is required.");
      }
      if (!/^[A-Za-z0-9_-]+$/.test(nextId)) {
        throw new Error(
          "MCP server ID can only include letters, numbers, underscores, and hyphens.",
        );
      }
      if (!endpoint) {
        throw new Error("MCP endpoint is required.");
      }

      const baseMap = mcpServerMapFromConfig(configSnapshot?.config ?? {});
      const previousId = mcpFormState.originalId;
      if (previousId && previousId !== nextId) {
        delete baseMap[previousId];
      }
      const existingServerConfig =
        typeof baseMap[nextId] === "object" && baseMap[nextId]
          ? { ...baseMap[nextId] }
          : {};
      delete existingServerConfig.url;
      delete existingServerConfig.command;
      delete existingServerConfig.endpoint;
      const nextServerConfig: Record<string, unknown> = {
        ...existingServerConfig,
        enabled: mcpFormState.enabled,
        disabled: !mcpFormState.enabled,
      };
      if (mcpFormState.transport === "command") {
        nextServerConfig.command = endpoint;
      } else {
        nextServerConfig.url = endpoint;
      }
      baseMap[nextId] = nextServerConfig;
      const message = await persistMcpServerMap(
        baseMap,
        previousId
          ? `Updated MCP server ${nextId}.`
          : `Added MCP server ${nextId}.`,
      );
      setMcpFormOpen(false);
      return message;
    }, "Failed to persist MCP server settings.");

  const handleDeleteMcpServer = (serverId: string) =>
    runAction(async () => {
      const baseMap = mcpServerMapFromConfig(configSnapshot?.config ?? {});
      if (!baseMap[serverId]) {
        return "MCP server already removed.";
      }
      delete baseMap[serverId];
      return persistMcpServerMap(baseMap, `Deleted MCP server ${serverId}.`);
    }, "Failed to delete MCP server.");

  const handleToggleMcpServer = (server: MappedMcpServer) =>
    runAction(async () => {
      const baseMap = mcpServerMapFromConfig(configSnapshot?.config ?? {});
      const current = baseMap[server.id] ?? server.config ?? {};
      baseMap[server.id] = {
        ...current,
        enabled: !server.enabled,
        disabled: server.enabled,
      };
      return persistMcpServerMap(
        baseMap,
        `${server.enabled ? "Disabled" : "Enabled"} MCP server ${server.id}.`,
      );
    }, "Failed to update MCP server status.");

  const handleConnectMcpServer = (
    server: MappedMcpServer,
    reconnect: boolean,
  ) =>
    runAction(async () => {
      const result = await startMcpServerOauthLogin({
        name: server.id,
      });
      await openExternalUrl(result.authorizationUrl);
      await reloadMcpServerConfig();
      await refreshMcpServers();
      return reconnect
        ? `Reconnect flow opened for ${server.id}.`
        : `Connect flow opened for ${server.id}.`;
    }, "Failed to start MCP OAuth flow.");

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
      await loadWorktreeRows();
      return output || "Worktree prune finished successfully.";
    }, "Failed to prune worktrees.");

  const handleRemoveWorktreeRow = (path: string) =>
    runAction(async () => {
      if (!resolvedWorkspace) {
        throw new Error("Select a workspace before removing worktrees.");
      }
      setRemovingWorktreePaths((current) => new Set(current).add(path));
      try {
        await removeWorktree(resolvedWorkspace, path);
        await loadWorktreeRows();
        return "Worktree removed.";
      } finally {
        setRemovingWorktreePaths((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      }
    }, "Failed to remove worktree.");

  const handleOpenLinkedConversation = (threadId: string) => {
    void navigate({
      to: "/t/$threadId",
      params: {
        threadId,
      },
    });
  };

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
      activeSectionId === "mcp-servers" ||
      activeSectionId === "environments"
    ) {
      void refreshMcpServers();
      return;
    }
    if (activeSectionId === "configuration") {
      void refreshConfigDiagnostics();
    }
  }, [activeSectionId, refreshConfigDiagnostics, refreshMcpServers]);

  useEffect(() => {
    if (activeSectionId !== "usage-analytics") {
      return;
    }
    void refreshRateLimits();
  }, [activeSectionId, refreshRateLimits]);

  useEffect(() => {
    if (activeSectionId !== "worktrees") {
      return;
    }
    void loadWorktreeRows().catch(() => {});
  }, [activeSectionId, loadWorktreeRows]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    return subscribeAppServerNotifications((notification) => {
      if (notification.method === "account/rateLimits/updated") {
        void refreshRateLimits();
      }
    });
  }, [refreshRateLimits]);

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
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-300">
              <p className="uppercase tracking-[0.2em] text-ink-500">
                Host runtime
              </p>
              <p className="mt-2">
                Build flavor:{" "}
                <span className="font-mono">
                  {hostBuildFlavorQuery.data
                    ? `${hostBuildFlavorQuery.data.flavor}:${hostBuildFlavorQuery.data.platform}`
                    : hostBuildFlavorQuery.isPending
                      ? "loading…"
                      : "unknown"}
                </span>
              </p>
              <p>
                Update state:{" "}
                <span className="font-mono">
                  {(hostUpdateEventState ?? hostUpdateStateQuery.data)
                    ?.status ??
                    (hostUpdateStateQuery.isPending ? "loading…" : "unknown")}
                </span>
              </p>
              <p className="text-ink-500">
                {(hostUpdateEventState ?? hostUpdateStateQuery.data)?.detail ??
                  "No update details."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={actionButtonClass}
                  onClick={() => {
                    void runAction(async () => {
                      const next = await checkForHostUpdates();
                      setHostUpdateEventState(next);
                      void queryClient.setQueryData(
                        ["host", "update-state"],
                        next,
                      );
                      return `Update check: ${next.status}`;
                    }, "Failed to check for updates.");
                  }}
                >
                  Check for updates
                </button>
                <button
                  className={actionButtonClass}
                  onClick={() => {
                    void hostUpdateStateQuery.refetch();
                    void hostBuildFlavorQuery.refetch();
                  }}
                >
                  Refresh runtime status
                </button>
              </div>
            </div>
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
      case "account": {
        const isAuthenticated = account?.isAuthenticated ?? false;
        const accountEmail =
          account?.email ?? (isAuthenticated ? "Signed in" : "Not signed in");
        const accountOrganization =
          account?.organizationName ??
          (account?.authMethod === "apiKey" ? "API key" : "Personal workspace");
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Account
            </p>
            <h2 className="font-display text-xl">Identity and access</h2>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-ink-100">{accountEmail}</p>
              <p className="text-xs text-ink-500">{accountOrganization}</p>
              <p className="mt-2 text-xs text-ink-400">
                Auth method: {account?.authMethod ?? "Unknown"}
              </p>
              <p className="text-xs text-ink-400">
                Status:{" "}
                {accountLoading
                  ? "Loading…"
                  : isAuthenticated
                    ? "Authenticated"
                    : "Not authenticated"}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {isAuthenticated ? (
                <button
                  className={actionButtonClass}
                  onClick={() => {
                    void handleRunAccountAction("logout");
                  }}
                  disabled={accountAction !== null}
                >
                  {accountAction === "logout" ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                <>
                  <button
                    className={actionButtonClass}
                    onClick={() => {
                      void handleRunAccountAction("login-chatgpt");
                    }}
                    disabled={accountAction !== null}
                  >
                    {accountAction === "login-chatgpt"
                      ? "Starting sign in…"
                      : "Sign in with ChatGPT"}
                  </button>
                  <button
                    className={actionButtonClass}
                    onClick={() => {
                      void handleRunAccountAction("login-api-key");
                    }}
                    disabled={accountAction !== null}
                  >
                    Sign in with API key
                  </button>
                </>
              )}
              <button
                className={actionButtonClass}
                onClick={() => {
                  void openExternalUrl(
                    "https://platform.openai.com/settings/organization",
                  );
                }}
              >
                Manage account in browser
              </button>
            </div>
          </section>
        );
      }
      case "data-controls":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Data controls
            </p>
            <h2 className="font-display text-xl">Local data locations</h2>
            <div className="mt-4 space-y-3 text-sm">
              {[
                {
                  label: "Codex home",
                  path: codexHomePath,
                },
                {
                  label: "Config file",
                  path: inferredConfigPath,
                },
                {
                  label: "Automation database",
                  path: inferredSqlitePath,
                },
                {
                  label: "Automation definitions",
                  path: inferredAutomationsPath,
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                    {entry.label}
                  </p>
                  <p className="mt-1 break-all text-xs text-ink-200">
                    {entry.path}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className={actionButtonClass}
                      onClick={() => {
                        void runAction(async () => {
                          await navigator.clipboard.writeText(entry.path);
                          return `Copied ${entry.label.toLowerCase()} path.`;
                        }, `Failed to copy ${entry.label.toLowerCase()} path.`);
                      }}
                    >
                      Copy path
                    </button>
                    <button
                      className={actionButtonClass}
                      onClick={() => {
                        void handleOpenPathInExplorer(
                          entry.path,
                          entry.label.toLowerCase(),
                        );
                      }}
                    >
                      Open folder
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void openExternalUrl(
                    "https://platform.openai.com/settings/data-controls",
                  );
                }}
              >
                Data controls in browser
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void openExternalUrl(
                    "https://platform.openai.com/settings/privacy",
                  );
                }}
              >
                Privacy settings in browser
              </button>
            </div>
          </section>
        );
      case "usage-analytics":
        return (
          <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Usage & analytics
            </p>
            <h2 className="font-display text-xl">
              Quota and telemetry visibility
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void runAction(async () => {
                    await refreshRateLimits();
                    return "Usage refreshed.";
                  }, "Failed to refresh usage.");
                }}
                disabled={rateLimitsLoading}
              >
                {rateLimitsLoading ? "Refreshing…" : "Refresh usage"}
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void openExternalUrl("https://platform.openai.com/usage");
                }}
              >
                Open usage dashboard
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void openExternalUrl(
                    "https://platform.openai.com/settings/organization/general",
                  );
                }}
              >
                Analytics settings in browser
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                {
                  label: "Primary limit",
                  window: rateLimits?.primary ?? null,
                },
                {
                  label: "Secondary limit",
                  window: rateLimits?.secondary ?? null,
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                    {entry.label}
                  </p>
                  {entry.window ? (
                    <div className="mt-2 space-y-1 text-xs text-ink-200">
                      <p>Used: {entry.window.usedPercent}%</p>
                      <p>
                        Window: {entry.window.windowDurationMins ?? "Unknown"}{" "}
                        min
                      </p>
                      <p>
                        Resets: {formatRateLimitResetAt(entry.window.resetsAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-500">Not available.</p>
                  )}
                </div>
              ))}
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
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleOpenConfigFile();
                }}
              >
                Copy config path
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void handleValidateConfig();
                }}
              >
                Validate TOML
              </button>
              <button
                className={actionButtonClass}
                onClick={() => {
                  void runAction(async () => {
                    await refreshConfigDiagnostics();
                    return "Configuration snapshot refreshed.";
                  }, "Failed to refresh configuration snapshot.");
                }}
              >
                Refresh snapshot
              </button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  Merged config preview
                </p>
                <pre className="codex-scrollbar mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[0.7rem] text-ink-200">
                  {configPreviewText}
                </pre>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  Layer origins
                </p>
                {configSnapshot?.layers.length ? (
                  <div className="mt-2 max-h-72 overflow-auto">
                    <table className="min-w-full text-left text-[0.7rem] text-ink-200">
                      <thead className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                        <tr>
                          <th className="px-2 py-1 font-medium">Layer</th>
                          <th className="px-2 py-1 font-medium">Version</th>
                          <th className="px-2 py-1 font-medium">File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configSnapshot.layers.map((layer) => (
                          <tr key={`${layer.name.type}-${layer.version}`}>
                            <td className="px-2 py-1">{layer.name.type}</td>
                            <td className="px-2 py-1">{layer.version}</td>
                            <td className="px-2 py-1 break-all">
                              {layer.name.file ?? "n/a"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-500">
                    No layer metadata loaded.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                Requirements
              </p>
              {configRequirements ? (
                <pre className="codex-scrollbar mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[0.7rem] text-ink-200">
                  {JSON.stringify(configRequirements, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-ink-500">
                  No config requirements returned by app-server.
                </p>
              )}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                Validation
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Keys checked: {configValidationResult?.keys.length ?? 0}
              </p>
              {!configErrors.length && !configWarnings.length ? (
                <p className="mt-2 text-xs text-emerald-300">
                  No schema/runtime validation issues detected.
                </p>
              ) : (
                <div className="mt-2 max-h-48 overflow-auto">
                  <table className="min-w-full text-left text-[0.7rem] text-ink-200">
                    <thead className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                      <tr>
                        <th className="px-2 py-1 font-medium">Severity</th>
                        <th className="px-2 py-1 font-medium">Key</th>
                        <th className="px-2 py-1 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configErrors.map((entry, index) => (
                        <tr key={`error-${entry.key}-${index}`}>
                          <td className="px-2 py-1 text-rose-300">Error</td>
                          <td className="px-2 py-1 font-mono">{entry.key}</td>
                          <td className="px-2 py-1">{entry.message}</td>
                        </tr>
                      ))}
                      {configWarnings.map((entry, index) => (
                        <tr key={`warning-${entry.key}-${index}`}>
                          <td className="px-2 py-1 text-amber-300">Warning</td>
                          <td className="px-2 py-1 font-mono">{entry.key}</td>
                          <td className="px-2 py-1">{entry.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
              {mcpServers.length ? (
                mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-ink-100">{server.name}</p>
                        <p className="truncate text-xs text-ink-500">
                          {server.endpoint}
                        </p>
                      </div>
                      <span className="text-xs text-ink-300">
                        {server.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <button
                        className={actionButtonClass}
                        onClick={() => openEditMcpForm(server)}
                        disabled={mcpMutating}
                      >
                        Edit
                      </button>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          void handleDeleteMcpServer(server.id);
                        }}
                        disabled={mcpMutating}
                      >
                        Delete
                      </button>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          void handleToggleMcpServer(server);
                        }}
                        disabled={mcpMutating}
                      >
                        {server.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          void handleConnectMcpServer(server, false);
                        }}
                        disabled={mcpMutating}
                      >
                        Connect
                      </button>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          void handleConnectMcpServer(server, true);
                        }}
                        disabled={mcpMutating}
                      >
                        Reconnect
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-500">
                  No MCP servers configured.
                </p>
              )}
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
                  openCreateMcpForm();
                }}
                disabled={mcpMutating}
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
            {mcpFormOpen ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  {mcpFormState.originalId
                    ? "Edit MCP server"
                    : "Add MCP server"}
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                      Server ID
                    </p>
                    <input
                      className={formInputClass}
                      value={mcpFormState.id}
                      onChange={(event) =>
                        setMcpFormState((current) => ({
                          ...current,
                          id: event.target.value,
                        }))
                      }
                      placeholder="github"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                      Transport
                    </p>
                    <select
                      className={formInputClass}
                      value={mcpFormState.transport}
                      onChange={(event) =>
                        setMcpFormState((current) => ({
                          ...current,
                          transport: event.target.value as McpServerTransport,
                        }))
                      }
                    >
                      <option value="url">URL endpoint</option>
                      <option value="command">Command</option>
                    </select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                      {mcpFormState.transport === "command"
                        ? "Command"
                        : "URL endpoint"}
                    </p>
                    <input
                      className={formInputClass}
                      value={mcpFormState.endpointValue}
                      onChange={(event) =>
                        setMcpFormState((current) => ({
                          ...current,
                          endpointValue: event.target.value,
                        }))
                      }
                      placeholder={
                        mcpFormState.transport === "command"
                          ? "npx -y @modelcontextprotocol/server-github"
                          : "https://example.mcp.local"
                      }
                    />
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-ink-300">
                  <input
                    type="checkbox"
                    checked={mcpFormState.enabled}
                    onChange={(event) =>
                      setMcpFormState((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  Enabled
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className={actionButtonClass}
                    onClick={() => {
                      void handleSubmitMcpForm();
                    }}
                    disabled={mcpMutating}
                  >
                    {mcpMutating ? "Saving…" : "Save MCP server"}
                  </button>
                  <button
                    className={actionButtonClass}
                    onClick={() => setMcpFormOpen(false)}
                    disabled={mcpMutating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
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
                onClick={() => {
                  void runAction(async () => {
                    await loadWorktreeRows();
                    return "Worktree inventory refreshed.";
                  }, "Failed to refresh worktree inventory.");
                }}
                disabled={worktreeRowsLoading}
              >
                {worktreeRowsLoading ? "Refreshing…" : "Refresh inventory"}
              </button>
              <button
                className={actionButtonClass}
                onClick={() => handleSave("worktrees")}
              >
                Save worktree settings
              </button>
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                Worktree inventory
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {resolvedWorkspace
                  ? `Workspace: ${resolvedWorkspace}`
                  : "No workspace selected."}
              </p>
              {worktreeRowsLoading ? (
                <p className="mt-3 text-sm text-ink-300">Loading worktrees…</p>
              ) : worktreeRowsError ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-rose-300">{worktreeRowsError}</p>
                  <button
                    className={actionButtonClass}
                    onClick={() => {
                      void runAction(async () => {
                        await loadWorktreeRows();
                        return "Worktree inventory refreshed.";
                      }, "Failed to refresh worktree inventory.");
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : !worktreeRows.length ? (
                <p className="mt-3 text-sm text-ink-400">
                  No worktrees found for this workspace.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-xs text-ink-200">
                    <thead className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">Path</th>
                        <th className="px-2 py-2 font-medium">Branch</th>
                        <th className="px-2 py-2 font-medium">Linked thread</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worktreeRows.map((row) => {
                        const isRemoving = removingWorktreePaths.has(row.path);
                        const disableRemove =
                          row.isCurrent || row.isBare || isRemoving;
                        const linkedThreadId = row.linkedThreadId;
                        const statusTokens = [
                          row.isCurrent ? "main" : null,
                          row.isDetached ? "detached" : null,
                          row.isBare ? "bare" : null,
                          row.isPrunable ? "prunable" : null,
                        ].filter((value): value is string => value !== null);
                        return (
                          <tr
                            key={row.path}
                            className="border-t border-white/5 align-top"
                          >
                            <td className="px-2 py-2">
                              <p className="break-all">{row.path}</p>
                              {row.head ? (
                                <p className="mt-1 text-[0.65rem] text-ink-500">
                                  HEAD: {row.head}
                                </p>
                              ) : null}
                              {row.prunableReason ? (
                                <p className="mt-1 text-[0.65rem] text-ink-500">
                                  {row.prunableReason}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2">
                              {row.branch ??
                                (row.isDetached ? "Detached" : "Unknown")}
                            </td>
                            <td className="px-2 py-2">
                              {linkedThreadId ? (
                                <button
                                  className="underline decoration-dotted underline-offset-2 hover:text-ink-50"
                                  onClick={() =>
                                    handleOpenLinkedConversation(linkedThreadId)
                                  }
                                >
                                  {linkedThreadId}
                                </button>
                              ) : (
                                <span className="text-ink-500">Not linked</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                {statusTokens.length ? (
                                  statusTokens.map((token) => (
                                    <span
                                      key={token}
                                      className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem]"
                                    >
                                      {token}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-ink-500">active</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  className={actionButtonClass}
                                  onClick={() => {
                                    void handleOpenPathInExplorer(
                                      row.path,
                                      "worktree folder",
                                    );
                                  }}
                                >
                                  Open folder
                                </button>
                                {linkedThreadId ? (
                                  <button
                                    className={actionButtonClass}
                                    onClick={() =>
                                      handleOpenLinkedConversation(
                                        linkedThreadId,
                                      )
                                    }
                                  >
                                    Open conversation
                                  </button>
                                ) : null}
                                <button
                                  className={actionButtonClass}
                                  onClick={() => {
                                    void handleRemoveWorktreeRow(row.path);
                                  }}
                                  disabled={disableRemove}
                                >
                                  {isRemoving
                                    ? "Removing…"
                                    : row.isCurrent
                                      ? "Main worktree"
                                      : "Remove"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
