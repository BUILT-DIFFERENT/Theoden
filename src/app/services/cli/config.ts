import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";
import { requestAppServer } from "@/app/services/cli/rpc";
import type { ProviderStatus } from "@/app/types";

export interface CodexConfig {
  model?: string;
  effort?: "medium" | "high" | "extra_high";
  verbosity?: "quiet" | "normal" | "verbose";
  [key: string]: unknown;
}

interface ConfigReadResponse {
  config?: JsonObject;
}

interface McpServerStatusListResponse {
  data?: unknown[];
  nextCursor?: string | null;
}

interface AccountReadResponse {
  account?: JsonObject | null;
  requiresOpenaiAuth?: boolean;
  [key: string]: unknown;
}

interface ConfigWriteResponse {
  status: "ok" | "okOverridden";
  version: string;
  filePath: string;
  overriddenMetadata?: {
    effectiveValue?: unknown;
    message?: string;
  } | null;
}

interface ConfigRequirementsReadResponse {
  requirements?: JsonObject | null;
}

interface McpServerOauthLoginResponse {
  authorizationUrl: string;
}

export interface MappedMcpServer {
  id: string;
  name: string;
  endpoint: string;
  status: "connected" | "disabled";
}

export type MappedProviderStatus = ProviderStatus;

export async function loadMergedConfig(cwd: string | null = null) {
  const result = await requestAppServer<ConfigReadResponse>({
    method: "config/read",
    params: {
      includeLayers: false,
      cwd,
    },
  });
  if (!result?.config || !isRecord(result.config)) {
    return {} satisfies CodexConfig;
  }
  return result.config as CodexConfig;
}

export async function validateConfig(cwd: string | null = null) {
  const config = await loadMergedConfig(cwd);
  return {
    valid: true,
    errors: [] as string[],
    keys: Object.keys(config).length,
  };
}

export function mcpServersFromConfig(config: CodexConfig): MappedMcpServer[] {
  const mcpRecord =
    (isRecord(config.mcp_servers) ? config.mcp_servers : null) ??
    (isRecord(config.mcpServers) ? config.mcpServers : null);
  if (!mcpRecord) {
    return [];
  }
  return Object.entries(mcpRecord).map(([id, value]) => {
    const serverConfig = isRecord(value) ? value : {};
    const endpoint =
      (typeof serverConfig.url === "string" && serverConfig.url) ||
      (typeof serverConfig.command === "string" && serverConfig.command) ||
      (typeof serverConfig.endpoint === "string" && serverConfig.endpoint) ||
      `mcp://${id}`;
    const disabledValue =
      (typeof serverConfig.disabled === "boolean" && serverConfig.disabled) ||
      (typeof serverConfig.enabled === "boolean" && !serverConfig.enabled);
    return {
      id,
      name: id.replace(/[-_]/g, " "),
      endpoint,
      status: disabledValue ? "disabled" : "connected",
    } satisfies MappedMcpServer;
  });
}

export async function loadMcpServerStatuses() {
  const result = await requestAppServer<McpServerStatusListResponse>({
    method: "mcpServerStatus/list",
    params: {
      cursor: null,
      limit: 100,
    },
  });
  const raw = (Array.isArray(result?.data) ? result?.data : null) ?? [];
  return raw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const id =
        (typeof entry.id === "string" && entry.id) ||
        (typeof entry.name === "string" && entry.name) ||
        null;
      if (!id) {
        return null;
      }
      const statusValue =
        (typeof entry.status === "string" && entry.status.toLowerCase()) ||
        "connected";
      const status: MappedMcpServer["status"] =
        statusValue === "disabled" || statusValue === "offline"
          ? "disabled"
          : "connected";
      return {
        id,
        status,
      };
    })
    .filter(
      (entry): entry is { id: string; status: MappedMcpServer["status"] } =>
        Boolean(entry),
    );
}

export async function loadAuthStatus() {
  const result = await requestAppServer<AccountReadResponse>({
    method: "account/read",
    params: {
      refreshToken: false,
    },
  });
  const account = isRecord(result?.account) ? result.account : null;
  const authMode =
    (account && typeof account.type === "string" ? account.type : null) ?? null;
  const status = authMode ? "authenticated" : "unauthenticated";
  const requiresOpenaiAuth =
    typeof result?.requiresOpenaiAuth === "boolean"
      ? result.requiresOpenaiAuth
      : null;
  return {
    status,
    requiresOpenaiAuth,
    authMode,
  };
}

export async function writeConfigValue(params: {
  keyPath: string;
  value: unknown;
  mergeStrategy: "replace" | "upsert";
  filePath?: string | null;
  expectedVersion?: string | null;
}) {
  const result = await requestAppServer<ConfigWriteResponse>({
    method: "config/value/write",
    params: {
      keyPath: params.keyPath,
      value: params.value,
      mergeStrategy: params.mergeStrategy,
      filePath: params.filePath ?? null,
      expectedVersion: params.expectedVersion ?? null,
    },
  });
  if (!result) {
    throw new Error("config/value/write returned no result");
  }
  return result;
}

export async function batchWriteConfig(params: {
  edits: Array<{
    keyPath: string;
    value: unknown;
    mergeStrategy: "replace" | "upsert";
  }>;
  filePath?: string | null;
  expectedVersion?: string | null;
}) {
  if (!params.edits.length) {
    throw new Error("At least one config edit is required.");
  }
  const result = await requestAppServer<ConfigWriteResponse>({
    method: "config/batchWrite",
    params: {
      edits: params.edits,
      filePath: params.filePath ?? null,
      expectedVersion: params.expectedVersion ?? null,
    },
  });
  if (!result) {
    throw new Error("config/batchWrite returned no result");
  }
  return result;
}

export async function readConfigRequirements() {
  const result = await requestAppServer<ConfigRequirementsReadResponse>({
    method: "configRequirements/read",
    params: {},
  });
  return isRecord(result?.requirements) ? result.requirements : null;
}

export async function reloadMcpServerConfig() {
  return requestAppServer({
    method: "config/mcpServer/reload",
    params: null,
  });
}

export async function startMcpServerOauthLogin(params: {
  name: string;
  scopes?: string[] | null;
  challenge?: string | null;
  redirectUrl?: string | null;
  port?: number | null;
}) {
  const result = await requestAppServer<McpServerOauthLoginResponse>({
    method: "mcpServer/oauth/login",
    params: {
      name: params.name,
      scopes: params.scopes ?? null,
      challenge: params.challenge ?? null,
      redirectUrl: params.redirectUrl ?? null,
      port: params.port ?? null,
    },
  });
  if (!result) {
    throw new Error("mcpServer/oauth/login returned no result");
  }
  return result;
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

function readBoolean(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

export function providersFromConfig(
  config: CodexConfig,
): MappedProviderStatus[] {
  const rootConfig = isRecord(config) ? config : {};
  const projectsRecord = isRecord(rootConfig.projects)
    ? rootConfig.projects
    : null;

  const localModel =
    typeof rootConfig.model === "string" ? rootConfig.model : null;
  const localDetail = localModel
    ? `Configured model: ${localModel}`
    : "Connected through app-server config";

  const worktreeStrategy =
    readString(rootConfig, "worktree_strategy", "worktreeStrategy") ??
    "workspace default";
  const hasProjects = Boolean(
    projectsRecord && Object.keys(projectsRecord).length,
  );
  const worktreeStatus: MappedProviderStatus["status"] = hasProjects
    ? "ready"
    : "unavailable";
  const worktreeDetail = hasProjects
    ? `Strategy: ${worktreeStrategy}`
    : "Add a workspace to enable worktree runs";

  const cloudConfig =
    (isRecord(rootConfig.cloud) ? rootConfig.cloud : null) ??
    (isRecord(rootConfig.cloud_exec) ? rootConfig.cloud_exec : null) ??
    (isRecord(rootConfig.cloudExec) ? rootConfig.cloudExec : null) ??
    {};
  const cloudEnabled =
    readBoolean(cloudConfig, "enabled", "use_cloud", "useCloud") ?? false;
  const cloudRegion = readString(
    cloudConfig,
    "region",
    "cloud_region",
    "cloudRegion",
  );
  const cloudEnvironment = readString(
    cloudConfig,
    "environment",
    "environment_id",
    "environmentId",
  );
  const cloudConfigured =
    cloudEnabled || Boolean(cloudRegion) || Boolean(cloudEnvironment);
  const cloudStatus: MappedProviderStatus["status"] = cloudConfigured
    ? "ready"
    : "unavailable";
  const cloudDetail = cloudConfigured
    ? cloudRegion
      ? `Region: ${cloudRegion}`
      : "Cloud execution configured"
    : "Cloud execution not configured";

  return [
    { id: "local", status: "ready", detail: localDetail },
    {
      id: "worktree",
      status: worktreeStatus,
      detail: worktreeDetail,
    },
    {
      id: "cloud",
      status: cloudStatus,
      detail: cloudDetail,
    },
  ];
}
