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
  servers?: unknown[];
  data?: unknown[];
}

interface McpServerOauthLoginResponse {
  authorizationUrl?: string;
  authorization_url?: string;
}

interface AuthStatusResponse {
  status?: string;
  authStatus?: string;
  requiresOpenaiAuth?: boolean;
  [key: string]: unknown;
}

export interface MappedMcpServer {
  id: string;
  name: string;
  endpoint: string;
  status: "connected" | "needs_auth" | "disabled" | "error";
  authStatus:
    | "unsupported"
    | "notLoggedIn"
    | "bearerToken"
    | "oauth"
    | "unknown";
}

export type MappedProviderStatus = ProviderStatus;

export interface McpServerRuntimeStatus {
  id: string;
  status: MappedMcpServer["status"];
  authStatus: MappedMcpServer["authStatus"];
}

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
      authStatus: "unknown",
    } satisfies MappedMcpServer;
  });
}

export async function loadMcpServerStatuses(): Promise<
  McpServerRuntimeStatus[]
> {
  const result = await requestAppServer<McpServerStatusListResponse>({
    method: "mcpServerStatus/list",
    params: {},
  });
  const raw =
    (Array.isArray(result?.servers) ? result?.servers : null) ??
    (Array.isArray(result?.data) ? result?.data : null) ??
    [];
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
      const authStatus = normalizeMcpAuthStatus(entry);
      const status = normalizeMcpRuntimeStatus(entry, authStatus);
      return {
        id,
        status,
        authStatus,
      };
    })
    .filter((entry): entry is McpServerRuntimeStatus => Boolean(entry));
}

export async function startMcpServerOauthLogin(
  name: string,
  options: {
    scopes?: string[] | null;
    timeoutSecs?: number | null;
  } = {},
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("MCP server name is required.");
  }
  const result = await requestAppServer<McpServerOauthLoginResponse>({
    method: "mcpServer/oauth/login",
    params: {
      name: trimmed,
      scopes:
        options.scopes && options.scopes.length ? options.scopes : undefined,
      timeoutSecs:
        typeof options.timeoutSecs === "number"
          ? options.timeoutSecs
          : undefined,
    },
  });
  const authorizationUrl =
    (typeof result?.authorizationUrl === "string" &&
      result.authorizationUrl.trim()) ||
    (typeof result?.authorization_url === "string" &&
      result.authorization_url.trim()) ||
    null;
  if (!authorizationUrl) {
    throw new Error(
      `MCP OAuth login for ${trimmed} did not return an authorization URL.`,
    );
  }
  return {
    name: trimmed,
    authorizationUrl,
  };
}

export async function reloadMcpServerConnections() {
  return requestAppServer({
    method: "config/mcpServer/reload",
  });
}

export async function loadAuthStatus() {
  const result = await requestAppServer<AuthStatusResponse>({
    method: "getAuthStatus",
    params: {},
  });
  const status =
    (typeof result?.status === "string" && result.status) ||
    (typeof result?.authStatus === "string" && result.authStatus) ||
    "unknown";
  const requiresOpenaiAuth =
    typeof result?.requiresOpenaiAuth === "boolean"
      ? result.requiresOpenaiAuth
      : null;
  return {
    status,
    requiresOpenaiAuth,
  };
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

function normalizeMcpRuntimeStatus(
  entry: Record<string, unknown>,
  authStatus: MappedMcpServer["authStatus"],
): MappedMcpServer["status"] {
  const statusValue =
    typeof entry.status === "string" ? entry.status.trim().toLowerCase() : null;
  if (
    statusValue === "disabled" ||
    statusValue === "offline" ||
    statusValue === "inactive"
  ) {
    return "disabled";
  }
  if (
    statusValue === "error" ||
    statusValue === "failed" ||
    statusValue === "unreachable"
  ) {
    return "error";
  }
  if (entry.disabled === true || entry.enabled === false) {
    return "disabled";
  }
  if (authStatus === "notLoggedIn") {
    return "needs_auth";
  }
  return "connected";
}

function normalizeMcpAuthStatus(
  entry: Record<string, unknown>,
): MappedMcpServer["authStatus"] {
  const raw =
    (typeof entry.authStatus === "string" && entry.authStatus) ||
    (typeof entry.auth_status === "string" && entry.auth_status) ||
    null;
  if (!raw) {
    return "unknown";
  }
  const normalized = raw.replace(/[\s_-]/g, "").toLowerCase();
  if (normalized === "unsupported") {
    return "unsupported";
  }
  if (normalized === "notloggedin") {
    return "notLoggedIn";
  }
  if (normalized === "bearertoken") {
    return "bearerToken";
  }
  if (normalized === "oauth") {
    return "oauth";
  }
  return "unknown";
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
