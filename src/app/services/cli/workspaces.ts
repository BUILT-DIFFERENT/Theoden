import {
  getString,
  isRecord,
  type JsonObject,
} from "@/app/services/cli/appServerPayload";
import { requestAppServer } from "@/app/services/cli/rpc";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

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

function normalizeWorkspacePathKey(path: string) {
  return normalizeWorkspacePath(path).toLowerCase();
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

async function readProjectsMap() {
  const result = await requestAppServer<ConfigReadResponse>({
    method: "config/read",
    params: {
      includeLayers: false,
      cwd: null,
    },
  });
  const config = result?.config;
  if (!isRecord(config)) {
    return {} as JsonObject;
  }
  const projects = config.projects;
  if (!isRecord(projects)) {
    return {} as JsonObject;
  }
  return { ...projects };
}

export async function listWorkspaces(): Promise<WorkspaceConfigEntry[]> {
  const projects = await readProjectsMap();
  return parseProjects({ projects });
}

export async function addWorkspace(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("Workspace path is required.");
  }
  const result = await requestAppServer<ConfigWriteResponse>({
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
  return result;
}

export async function removeWorkspace(path: string) {
  const normalizedPath = normalizeWorkspacePath(path);
  if (!normalizedPath) {
    throw new Error("Workspace path is required.");
  }
  const projects = await readProjectsMap();
  const normalizedKey = normalizeWorkspacePathKey(normalizedPath);
  const matchingPath = Object.keys(projects).find(
    (entryPath) => normalizeWorkspacePathKey(entryPath) === normalizedKey,
  );
  if (!matchingPath) {
    return { status: "ok" as const };
  }
  delete projects[matchingPath];

  const result = await requestAppServer<ConfigWriteResponse>({
    method: "config/value/write",
    params: {
      keyPath: "projects",
      value: projects,
      mergeStrategy: "replace",
      filePath: null,
      expectedVersion: null,
    },
  });
  return result;
}

export async function setWorkspaceTrustLevel(
  path: string,
  trustLevel: "trusted" | "untrusted",
) {
  const normalizedPath = normalizeWorkspacePath(path);
  if (!normalizedPath) {
    throw new Error("Workspace path is required.");
  }

  const projects = await readProjectsMap();
  const normalizedKey = normalizeWorkspacePathKey(normalizedPath);
  const existingPath = Object.keys(projects).find(
    (entryPath) => normalizeWorkspacePathKey(entryPath) === normalizedKey,
  );
  const targetPath = existingPath ?? normalizedPath;
  const currentEntry = projects[targetPath];
  const nextEntry: JsonObject = isRecord(currentEntry)
    ? { ...currentEntry }
    : {};
  nextEntry.trust_level = trustLevel;
  projects[targetPath] = nextEntry;

  const result = await requestAppServer<ConfigWriteResponse>({
    method: "config/value/write",
    params: {
      keyPath: "projects",
      value: projects,
      mergeStrategy: "replace",
      filePath: null,
      expectedVersion: null,
    },
  });
  return result;
}
