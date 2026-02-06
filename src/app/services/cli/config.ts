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
    : "stub";
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
