import { sendAppServerRequest } from "@/app/services/cli/appServer";
import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";

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

function requestId() {
  return Math.floor(Date.now() + Math.random() * 1000);
}

export async function loadMergedConfig(cwd: string | null = null) {
  const response = await sendAppServerRequest<ConfigReadResponse>({
    id: requestId(),
    method: "config/read",
    params: {
      includeLayers: false,
      cwd,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  if (!response.result?.config || !isRecord(response.result.config)) {
    return {} satisfies CodexConfig;
  }
  return response.result.config as CodexConfig;
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
