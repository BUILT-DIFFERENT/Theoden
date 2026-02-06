import { sendAppServerRequest } from "@/app/services/cli/appServer";
import {
  getString,
  isRecord,
  type JsonObject,
} from "@/app/services/cli/appServerPayload";

export interface WorkspaceConfigEntry {
  path: string;
  trustLevel?: "trusted" | "untrusted";
}

interface ConfigReadResponse {
  config?: JsonObject;
}

interface ConfigWriteResponse {
  status: "ok" | "okOverridden";
  message?: string;
}

function requestId() {
  return Math.floor(Date.now() + Math.random() * 1000);
}

function parseProjects(config?: JsonObject): WorkspaceConfigEntry[] {
  if (!config) return [];
  const projects = config.projects;
  if (!isRecord(projects)) return [];
  return Object.entries(projects).map(([path, value]) => {
    const trustLevel = isRecord(value)
      ? getString(value, "trust_level")
      : undefined;
    return {
      path,
      trustLevel:
        trustLevel === "trusted" || trustLevel === "untrusted"
          ? trustLevel
          : undefined,
    };
  });
}

export async function listWorkspaces(): Promise<WorkspaceConfigEntry[]> {
  const response = await sendAppServerRequest<ConfigReadResponse>({
    id: requestId(),
    method: "config/read",
    params: {
      includeLayers: false,
      cwd: null,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return parseProjects(response.result?.config);
}

export async function addWorkspace(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("Workspace path is required.");
  }
  const response = await sendAppServerRequest<ConfigWriteResponse>({
    id: requestId(),
    method: "config/value/write",
    params: {
      keyPath: "projects",
      value: {
        [trimmed]: {
          trust_level: "trusted",
        },
      },
      mergeStrategy: "upsert",
      filePath: null,
      expectedVersion: null,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result;
}
