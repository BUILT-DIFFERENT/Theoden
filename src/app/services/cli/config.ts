import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";
import {
  getConfigWarnings,
  type ConfigWarningEntry,
} from "@/app/services/cli/configWarnings";
import { AppServerRpcError, requestAppServer } from "@/app/services/cli/rpc";
import type { ProviderStatus } from "@/app/types";

export interface CodexConfig {
  model?: string;
  effort?: "medium" | "high" | "extra_high";
  verbosity?: "quiet" | "normal" | "verbose";
  [key: string]: unknown;
}

export interface ConfigLayerSource {
  type: string;
  file?: string;
  dotCodexFolder?: string;
  domain?: string;
  key?: string;
  [key: string]: unknown;
}

export interface ConfigLayerMetadata {
  name: ConfigLayerSource;
  version: string;
}

export interface ConfigLayer {
  name: ConfigLayerSource;
  version: string;
  config: unknown;
  disabledReason: string | null;
}

export interface ConfigWriteTarget {
  filePath: string | null;
  expectedVersion: string | null;
}

export interface ConfigReadSnapshot {
  config: CodexConfig;
  origins: Record<string, ConfigLayerMetadata>;
  layers: ConfigLayer[];
  writeTarget: ConfigWriteTarget;
}

interface ConfigReadResponse {
  config?: JsonObject;
  origins?: Record<string, unknown>;
  layers?: unknown[] | null;
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

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: ConfigWarningEntry[];
  keys: number;
}

function readLayerSource(value: unknown): ConfigLayerSource | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = value.type;
  if (typeof type !== "string" || !type.trim()) {
    return null;
  }
  return value as ConfigLayerSource;
}

function readLayerMetadata(value: unknown): ConfigLayerMetadata | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = readLayerSource(value.name);
  const version = value.version;
  if (!name || typeof version !== "string") {
    return null;
  }
  return {
    name,
    version,
  };
}

function readConfigLayer(value: unknown): ConfigLayer | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = readLayerSource(value.name);
  const version = value.version;
  if (!name || typeof version !== "string") {
    return null;
  }
  const disabledReasonValue = value.disabledReason;
  const disabledReason =
    typeof disabledReasonValue === "string" ? disabledReasonValue : null;
  return {
    name,
    version,
    config: value.config,
    disabledReason,
  };
}

function readConfigOrigins(
  value: Record<string, unknown> | undefined,
): Record<string, ConfigLayerMetadata> {
  if (!value) {
    return {};
  }
  return Object.entries(value).reduce<Record<string, ConfigLayerMetadata>>(
    (accumulator, [key, entry]) => {
      const metadata = readLayerMetadata(entry);
      if (!metadata) {
        return accumulator;
      }
      accumulator[key] = metadata;
      return accumulator;
    },
    {},
  );
}

function resolveWriteTarget(
  layers: ConfigLayer[],
  origins: Record<string, ConfigLayerMetadata>,
): ConfigWriteTarget {
  const userLayer = layers.find((layer) => layer.name.type === "user");
  if (userLayer) {
    const filePath =
      typeof userLayer.name.file === "string" ? userLayer.name.file : null;
    const expectedVersion = userLayer.version || null;
    return {
      filePath,
      expectedVersion,
    };
  }

  for (const metadata of Object.values(origins)) {
    if (metadata.name.type !== "user") {
      continue;
    }
    return {
      filePath:
        typeof metadata.name.file === "string" ? metadata.name.file : null,
      expectedVersion: metadata.version || null,
    };
  }

  return {
    filePath: null,
    expectedVersion: null,
  };
}

export async function loadConfigSnapshot(
  cwd: string | null = null,
): Promise<ConfigReadSnapshot> {
  const result = await requestAppServer<ConfigReadResponse>({
    method: "config/read",
    params: {
      includeLayers: true,
      cwd,
    },
  });
  const config =
    result?.config && isRecord(result.config)
      ? (result.config as CodexConfig)
      : ({} satisfies CodexConfig);
  const origins = readConfigOrigins(
    result?.origins && isRecord(result.origins) ? result.origins : undefined,
  );
  const layers = Array.isArray(result?.layers)
    ? result.layers
        .map((layer) => readConfigLayer(layer))
        .filter((layer): layer is ConfigLayer => Boolean(layer))
    : [];
  const writeTarget = resolveWriteTarget(layers, origins);
  return {
    config,
    origins,
    layers,
    writeTarget,
  };
}

export async function loadMergedConfig(cwd: string | null = null) {
  const snapshot = await loadConfigSnapshot(cwd);
  return snapshot.config;
}

function normalizeConfigWriteErrorCode(code: string | null) {
  if (!code) {
    return null;
  }
  return code.trim().toLowerCase();
}

export function readConfigWriteErrorCode(error: unknown): string | null {
  if (!(error instanceof AppServerRpcError) || !isRecord(error.data)) {
    return null;
  }
  const value = error.data.config_write_error_code;
  return typeof value === "string" ? value : null;
}

export function mapConfigWriteErrorMessage(
  error: unknown,
  fallbackMessage = "Failed to update config.",
) {
  const normalizedCode = normalizeConfigWriteErrorCode(
    readConfigWriteErrorCode(error),
  );
  if (normalizedCode === "configversionconflict") {
    return "Config changed on disk. Reload settings and retry.";
  }
  if (normalizedCode === "configlayerreadonly") {
    return "This config layer is read-only and cannot be modified here.";
  }
  if (normalizedCode === "configvalidationerror") {
    return "Config update is invalid. Fix validation errors and retry.";
  }
  if (normalizedCode === "configpathnotfound") {
    return "Config file path not found. Refresh settings and retry.";
  }
  if (normalizedCode === "configschemaunknownkey") {
    return "Config contains unsupported keys for this server version.";
  }
  if (normalizedCode === "userlayernotfound") {
    return "User config layer was not found. Create a user config file first.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
}

export async function validateConfig(cwd: string | null = null) {
  const warnings = getConfigWarnings();
  try {
    const snapshot = await loadConfigSnapshot(cwd);
    return {
      valid: true,
      errors: [] as string[],
      warnings,
      keys: Object.keys(snapshot.config).length,
    } satisfies ConfigValidationResult;
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Failed to read config.";
    return {
      valid: false,
      errors: [message],
      warnings,
      keys: 0,
    } satisfies ConfigValidationResult;
  }
}

export async function writeMcpServerConfig(params: {
  serverId: string;
  value: unknown;
  cwd?: string | null;
}) {
  const serverId = params.serverId.trim();
  if (!serverId) {
    throw new Error("MCP server ID is required.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(serverId)) {
    throw new Error(
      `Invalid MCP server ID "${serverId}". Use only letters, numbers, underscores, and hyphens.`,
    );
  }
  const snapshot = await loadConfigSnapshot(params.cwd ?? null);
  return batchWriteConfig({
    edits: [
      {
        keyPath: `mcp_servers.${serverId}`,
        value: params.value,
        mergeStrategy: "replace",
      },
    ],
    filePath: snapshot.writeTarget.filePath,
    expectedVersion: snapshot.writeTarget.expectedVersion,
  });
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
