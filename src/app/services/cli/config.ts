import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";
import {
  getConfigWarnings,
  type ConfigWarningEntry,
} from "@/app/services/cli/configWarnings";
import { AppServerRpcError, requestAppServer } from "@/app/services/cli/rpc";
import type { ProviderStatus } from "@/app/types";

import configSchema from "../../../../codex-rs/core/config.schema.json";

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
  enabled: boolean;
  status: "connected" | "disabled";
  config: Record<string, unknown>;
}

export type MappedProviderStatus = ProviderStatus;

export interface ConfigValidationIssue {
  key: string;
  message: string;
  source: "schema" | "runtime" | "warning";
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  keys: string[];
}

interface JsonSchemaNode {
  $ref?: string;
  type?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode | JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  definitions?: Record<string, JsonSchemaNode>;
}

const rootConfigSchema = configSchema as JsonSchemaNode;

function schemaDefinitions() {
  return rootConfigSchema.definitions ?? {};
}

function resolveSchemaNode(
  node: JsonSchemaNode,
  seen = new Set<string>(),
): JsonSchemaNode {
  if (!node.$ref) {
    return node;
  }
  if (!node.$ref.startsWith("#/definitions/")) {
    return node;
  }
  const key = node.$ref.slice("#/definitions/".length);
  if (!key || seen.has(key)) {
    return node;
  }
  const definition = schemaDefinitions()[key];
  if (!definition) {
    return node;
  }
  seen.add(key);
  return resolveSchemaNode(definition, seen);
}

function configWarningToIssue(
  warning: ConfigWarningEntry,
): ConfigValidationIssue {
  const details = warning.details ? ` ${warning.details}` : "";
  return {
    key: warning.path ?? "config",
    message: `${warning.summary}${details}`.trim(),
    source: "warning",
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenConfigKeys(value: unknown, prefix = ""): string[] {
  if (!isPlainObject(value)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    if (isPlainObject(child)) {
      keys.push(...flattenConfigKeys(child, path));
    }
  });
  return keys;
}

function pushConfigError(
  errors: ConfigValidationIssue[],
  key: string,
  message: string,
  source: ConfigValidationIssue["source"] = "schema",
) {
  errors.push({
    key,
    message,
    source,
  });
}

function schemaAllowsType(
  schema: JsonSchemaNode,
  value: unknown,
): boolean | null {
  const resolved = resolveSchemaNode(schema);
  if (resolved.oneOf?.length) {
    return resolved.oneOf.some((candidate) =>
      schemaAllowsType(candidate, value),
    );
  }
  if (resolved.anyOf?.length) {
    return resolved.anyOf.some((candidate) =>
      schemaAllowsType(candidate, value),
    );
  }
  if (resolved.allOf?.length) {
    return resolved.allOf.every((candidate) =>
      schemaAllowsType(candidate, value),
    );
  }
  if (!resolved.type) {
    return null;
  }
  switch (resolved.type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return isPlainObject(value);
    default:
      return null;
  }
}

function validateValueBySchema(
  value: unknown,
  schema: JsonSchemaNode,
  keyPath: string,
  errors: ConfigValidationIssue[],
) {
  const resolved = resolveSchemaNode(schema);
  if (resolved.oneOf?.length) {
    const anyValid = resolved.oneOf.some((candidate) => {
      const candidateErrors: ConfigValidationIssue[] = [];
      validateValueBySchema(value, candidate, keyPath, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!anyValid) {
      pushConfigError(
        errors,
        keyPath,
        "Value does not match any allowed shape.",
      );
    }
    return;
  }
  if (resolved.anyOf?.length) {
    const anyValid = resolved.anyOf.some((candidate) => {
      const candidateErrors: ConfigValidationIssue[] = [];
      validateValueBySchema(value, candidate, keyPath, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!anyValid) {
      pushConfigError(
        errors,
        keyPath,
        "Value does not match any allowed variant.",
      );
    }
    return;
  }
  if (resolved.allOf?.length) {
    resolved.allOf.forEach((candidate) =>
      validateValueBySchema(value, candidate, keyPath, errors),
    );
  }

  const typeMatches = schemaAllowsType(resolved, value);
  if (typeMatches === false) {
    pushConfigError(errors, keyPath, `Expected ${resolved.type}.`);
    return;
  }

  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    const allowed = resolved.enum.some((entry) => entry === value);
    if (!allowed) {
      pushConfigError(
        errors,
        keyPath,
        `Expected one of: ${resolved.enum.join(", ")}.`,
      );
    }
  }

  if (typeof value === "string") {
    if (
      typeof resolved.minLength === "number" &&
      value.length < resolved.minLength
    ) {
      pushConfigError(
        errors,
        keyPath,
        `Must be at least ${resolved.minLength} characters.`,
      );
    }
    if (
      typeof resolved.maxLength === "number" &&
      value.length > resolved.maxLength
    ) {
      pushConfigError(
        errors,
        keyPath,
        `Must be at most ${resolved.maxLength} characters.`,
      );
    }
    if (typeof resolved.pattern === "string") {
      try {
        const expression = new RegExp(resolved.pattern);
        if (!expression.test(value)) {
          pushConfigError(errors, keyPath, "Value format is invalid.");
        }
      } catch {
        // Ignore invalid schema regex patterns.
      }
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof resolved.minimum === "number" && value < resolved.minimum) {
      pushConfigError(errors, keyPath, `Must be >= ${resolved.minimum}.`);
    }
    if (typeof resolved.maximum === "number" && value > resolved.maximum) {
      pushConfigError(errors, keyPath, `Must be <= ${resolved.maximum}.`);
    }
  }

  if (isPlainObject(value)) {
    const properties = resolved.properties ?? {};
    Object.entries(value).forEach(([propertyKey, propertyValue]) => {
      const propertyPath = keyPath ? `${keyPath}.${propertyKey}` : propertyKey;
      const propertySchema = properties[propertyKey];
      if (propertySchema) {
        validateValueBySchema(
          propertyValue,
          propertySchema,
          propertyPath,
          errors,
        );
        return;
      }
      if (resolved.additionalProperties === false) {
        pushConfigError(errors, propertyPath, "Unknown config key.");
        return;
      }
      if (
        resolved.additionalProperties &&
        typeof resolved.additionalProperties === "object"
      ) {
        validateValueBySchema(
          propertyValue,
          resolved.additionalProperties,
          propertyPath,
          errors,
        );
      }
    });
  }

  if (Array.isArray(value)) {
    if (!resolved.items) {
      return;
    }
    if (Array.isArray(resolved.items)) {
      const tupleItems: JsonSchemaNode[] = resolved.items;
      value.forEach((entry, index) => {
        const itemSchema = tupleItems[index];
        if (itemSchema) {
          validateValueBySchema(
            entry,
            itemSchema,
            `${keyPath}[${index}]`,
            errors,
          );
        }
      });
      return;
    }
    value.forEach((entry, index) => {
      validateValueBySchema(
        entry,
        resolved.items as JsonSchemaNode,
        `${keyPath}[${index}]`,
        errors,
      );
    });
  }
}

function validateRuntimeConstraints(config: CodexConfig) {
  const errors: ConfigValidationIssue[] = [];
  const warnings: ConfigValidationIssue[] = [];
  const record = isRecord(config) ? config : {};

  const mcpRecord =
    (isRecord(record.mcp_servers) ? record.mcp_servers : null) ??
    (isRecord(record.mcpServers) ? record.mcpServers : null);
  if (mcpRecord) {
    Object.entries(mcpRecord).forEach(([serverId, value]) => {
      if (!isRecord(value)) {
        pushConfigError(
          errors,
          `mcp_servers.${serverId}`,
          "MCP server entry must be an object.",
          "runtime",
        );
        return;
      }
      const hasEndpoint = Boolean(
        (typeof value.url === "string" && value.url.trim()) ||
          (typeof value.command === "string" && value.command.trim()) ||
          (typeof value.endpoint === "string" && value.endpoint.trim()),
      );
      if (!hasEndpoint) {
        pushConfigError(
          errors,
          `mcp_servers.${serverId}`,
          "Provide one of: `url`, `command`, or `endpoint`.",
          "runtime",
        );
      }
    });
  }

  const timeoutCandidates: Array<{ key: string; value: unknown }> = [
    { key: "mcp_request_timeout", value: record.mcp_request_timeout },
    {
      key: "mcp_request_timeout_seconds",
      value: record.mcp_request_timeout_seconds,
    },
    { key: "mcpRequestTimeout", value: record.mcpRequestTimeout },
  ];
  timeoutCandidates.forEach((candidate) => {
    if (candidate.value === undefined || candidate.value === null) {
      return;
    }
    if (
      typeof candidate.value !== "number" ||
      !Number.isFinite(candidate.value)
    ) {
      pushConfigError(
        errors,
        candidate.key,
        "Timeout must be a number.",
        "runtime",
      );
      return;
    }
    if (candidate.value < 1 || candidate.value > 600) {
      pushConfigError(
        errors,
        candidate.key,
        "Timeout must be between 1 and 600 seconds.",
        "runtime",
      );
    }
  });

  const defaultEnvironment = record.default_environment;
  if (
    typeof defaultEnvironment === "string" &&
    !["local", "worktree", "cloud"].includes(defaultEnvironment)
  ) {
    pushConfigError(
      errors,
      "default_environment",
      "Expected one of: local, worktree, cloud.",
      "runtime",
    );
  }

  const cloudConfig =
    (isRecord(record.cloud) ? record.cloud : null) ??
    (isRecord(record.cloud_exec) ? record.cloud_exec : null) ??
    (isRecord(record.cloudExec) ? record.cloudExec : null);
  if (defaultEnvironment === "cloud" && cloudConfig) {
    const hasCloudContext = Boolean(
      (typeof cloudConfig.region === "string" && cloudConfig.region.trim()) ||
        (typeof cloudConfig.environment === "string" &&
          cloudConfig.environment.trim()) ||
        (typeof cloudConfig.environment_id === "string" &&
          cloudConfig.environment_id.trim()),
    );
    if (!hasCloudContext) {
      warnings.push({
        key: "cloud",
        message:
          "Cloud is the default environment, but no explicit cloud region/environment is configured.",
        source: "runtime",
      });
    }
  }

  return { errors, warnings };
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
  const configWarnings = getConfigWarnings().map(configWarningToIssue);
  try {
    const snapshot = await loadConfigSnapshot(cwd);
    const schemaErrors: ConfigValidationIssue[] = [];
    validateValueBySchema(
      snapshot.config,
      rootConfigSchema,
      "config",
      schemaErrors,
    );
    const runtime = validateRuntimeConstraints(snapshot.config);
    const keys = flattenConfigKeys(snapshot.config);
    const errors = [...schemaErrors, ...runtime.errors];
    const warnings = [...configWarnings, ...runtime.warnings];
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      keys,
    } satisfies ConfigValidationResult;
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Failed to read config snapshot.";
    return {
      valid: false,
      errors: [
        {
          key: "config",
          message,
          source: "runtime",
        },
      ],
      warnings: configWarnings,
      keys: [],
    } satisfies ConfigValidationResult;
  }
}

export async function writeMcpServersConfig(params: {
  servers: Record<string, unknown>;
  cwd?: string | null;
}) {
  const snapshot = await loadConfigSnapshot(params.cwd ?? null);
  return batchWriteConfig({
    edits: [
      {
        keyPath: "mcp_servers",
        value: params.servers,
        mergeStrategy: "replace",
      },
    ],
    filePath: snapshot.writeTarget.filePath,
    expectedVersion: snapshot.writeTarget.expectedVersion,
  });
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
    const enabled = !disabledValue;
    return {
      id,
      name: id.replace(/[-_]/g, " "),
      endpoint,
      enabled,
      status: enabled ? "connected" : "disabled",
      config: serverConfig,
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
