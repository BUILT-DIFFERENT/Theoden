import {
  getArray,
  getObject,
  getString,
  isRecord,
  type JsonObject,
} from "@/app/services/cli/appServerPayload";
import { requestAppServer } from "@/app/services/cli/rpc";

export interface SkillCatalogError {
  path: string;
  message: string;
}

export interface SkillCatalogSkill {
  id: string;
  name: string;
  description: string;
  documentation: string;
  path: string;
  enabled: boolean;
  scope: "user" | "repo" | "system" | "admin";
  defaultPrompt: string | null;
  permissions: string[];
}

export interface SkillCatalogEntry {
  cwd: string;
  skills: SkillCatalogSkill[];
  errors: SkillCatalogError[];
}

export interface RemoteSkillCatalogEntry {
  id: string;
  name: string;
  description: string;
}

interface SkillsListResponse {
  data?: unknown;
}

interface SkillsConfigWriteResponse {
  effectiveEnabled?: boolean;
}

interface SkillsRemoteReadResponse {
  data?: unknown;
}

interface SkillsRemoteWriteResponse {
  id?: string;
  name?: string;
  path?: string;
}

function readBoolean(record: JsonObject, key: string, fallback = false) {
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function parseScope(value: string | undefined): SkillCatalogSkill["scope"] {
  if (value === "user") return "user";
  if (value === "repo") return "repo";
  if (value === "system") return "system";
  if (value === "admin") return "admin";
  return "repo";
}

function permissionsFromSkill(skill: JsonObject) {
  const dependencies = getObject(skill, "dependencies");
  const tools = dependencies ? getArray(dependencies, "tools") : undefined;
  const permissions = new Set<string>();
  tools?.forEach((tool) => {
    if (!isRecord(tool)) {
      return;
    }
    const value = getString(tool, "value");
    if (value) {
      permissions.add(value);
      return;
    }
    const type = getString(tool, "type");
    if (type) {
      permissions.add(type);
    }
  });
  if (!permissions.size) {
    permissions.add("workspace");
  }
  return Array.from(permissions.values()).sort();
}

function documentationFromSkill(skill: JsonObject, description: string) {
  const path = getString(skill, "path");
  const interfaceRecord = getObject(skill, "interface");
  const defaultPrompt = interfaceRecord
    ? getString(interfaceRecord, "defaultPrompt")
    : undefined;
  const docs = [description.trim()];
  if (defaultPrompt) {
    docs.push(`Default prompt:\n${defaultPrompt.trim()}`);
  }
  if (path) {
    docs.push(`Path: ${path}`);
  }
  return docs.filter(Boolean).join("\n\n");
}

function parseSkill(skill: unknown): SkillCatalogSkill | null {
  if (!isRecord(skill)) {
    return null;
  }
  const name = getString(skill, "name");
  const description = getString(skill, "description");
  const path = getString(skill, "path");
  if (!name || !description || !path) {
    return null;
  }
  const interfaceRecord = getObject(skill, "interface");
  const displayName = interfaceRecord
    ? getString(interfaceRecord, "displayName")
    : undefined;
  const shortDescription = interfaceRecord
    ? getString(interfaceRecord, "shortDescription")
    : undefined;
  return {
    id: name,
    name: displayName ?? name,
    description: shortDescription ?? description,
    documentation: documentationFromSkill(skill, description),
    path,
    enabled: readBoolean(skill, "enabled", true),
    scope: parseScope(getString(skill, "scope")),
    defaultPrompt:
      (interfaceRecord ? getString(interfaceRecord, "defaultPrompt") : null) ??
      null,
    permissions: permissionsFromSkill(skill),
  };
}

function parseSkillError(value: unknown): SkillCatalogError | null {
  if (!isRecord(value)) {
    return null;
  }
  const path = getString(value, "path");
  const message = getString(value, "message");
  if (!path || !message) {
    return null;
  }
  return { path, message };
}

function parseSkillsListData(data: unknown): SkillCatalogEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const cwd = getString(entry, "cwd");
      if (!cwd) {
        return null;
      }
      const skills = (getArray(entry, "skills") ?? [])
        .map((skill) => parseSkill(skill))
        .filter((skill): skill is SkillCatalogSkill => skill !== null);
      const errors = (getArray(entry, "errors") ?? [])
        .map((error) => parseSkillError(error))
        .filter((error): error is SkillCatalogError => error !== null);
      return {
        cwd,
        skills,
        errors,
      } satisfies SkillCatalogEntry;
    })
    .filter((entry): entry is SkillCatalogEntry => entry !== null);
}

function parseRemoteSkill(value: unknown): RemoteSkillCatalogEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = getString(value, "id");
  const name = getString(value, "name");
  const description = getString(value, "description");
  if (!id || !name || !description) {
    return null;
  }
  return { id, name, description };
}

export async function listSkills(params?: {
  cwds?: string[];
  forceReload?: boolean;
}) {
  const result = await requestAppServer<SkillsListResponse>({
    method: "skills/list",
    params: {
      cwds: params?.cwds?.length ? params.cwds : null,
      forceReload: params?.forceReload ?? false,
    },
  });
  return parseSkillsListData(result?.data);
}

export async function writeSkillEnabled(path: string, enabled: boolean) {
  const trimmedPath = path.trim();
  if (!trimmedPath.length) {
    throw new Error("Skill path is required.");
  }
  const result = await requestAppServer<SkillsConfigWriteResponse>({
    method: "skills/config/write",
    params: {
      path: trimmedPath,
      enabled,
    },
  });
  return result?.effectiveEnabled ?? enabled;
}

export async function listRemoteSkillsExperimental() {
  const result = await requestAppServer<SkillsRemoteReadResponse>({
    method: "skills/remote/read",
    params: {},
  });
  const data = result?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((entry) => parseRemoteSkill(entry))
    .filter((entry): entry is RemoteSkillCatalogEntry => entry !== null);
}

export async function installRemoteSkillExperimental(hazelnutId: string) {
  const trimmedId = hazelnutId.trim();
  if (!trimmedId.length) {
    throw new Error("Remote skill ID is required.");
  }
  const result = await requestAppServer<SkillsRemoteWriteResponse>({
    method: "skills/remote/write",
    params: {
      hazelnutId: trimmedId,
      isPreload: false,
    },
  });
  const path = result?.path;
  if (!path) {
    throw new Error("Remote skill install did not return a path.");
  }
  return {
    id: result?.id ?? trimmedId,
    name: result?.name ?? trimmedId,
    path,
  };
}
