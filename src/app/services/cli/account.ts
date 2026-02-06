import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";
import { requestAppServer } from "@/app/services/cli/rpc";

export interface AccountInfo {
  isAuthenticated: boolean;
  email: string | null;
  organizationName: string | null;
  authMethod: string | null;
}

interface AccountReadResponse {
  account?: JsonObject | null;
  requiresOpenaiAuth?: boolean;
  [key: string]: unknown;
}

interface AccountLoginStartResponse {
  type?: string;
  loginId?: string;
  authUrl?: string;
  [key: string]: unknown;
}

function readString(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

function readBoolean(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function parseAccountInfo(response: AccountReadResponse): AccountInfo {
  const source = isRecord(response.account) ? response.account : null;
  if (!source) {
    return {
      isAuthenticated: false,
      email: null,
      organizationName: null,
      authMethod: null,
    };
  }

  const email = readString(source, ["email", "userEmail", "username", "login"]);
  const accountType = readString(source, ["type"]);
  const planType = readString(source, ["planType"]);
  const organizationName =
    readString(source, [
      "organizationName",
      "organization",
      "orgName",
      "workspaceName",
    ]) ?? (accountType === "apiKey" ? "API key" : planType);
  const authMethod = readString(source, [
    "type",
    "authMethod",
    "provider",
    "loginMethod",
  ]);

  const isAuthenticated =
    readBoolean(source, [
      "isAuthenticated",
      "authenticated",
      "loggedIn",
      "signedIn",
    ]) ?? Boolean(source);

  return {
    isAuthenticated,
    email,
    organizationName,
    authMethod,
  };
}

export async function readAccount() {
  const result = await requestAppServer<AccountReadResponse>({
    method: "account/read",
    params: {
      refreshToken: false,
    },
  });
  return parseAccountInfo(result ?? {});
}

export async function startAccountLogin(
  mode: "chatgpt" | "apiKey",
  apiKey?: string,
) {
  const params =
    mode === "apiKey"
      ? {
          type: "apiKey" as const,
          apiKey: apiKey?.trim() ?? "",
        }
      : {
          type: "chatgpt" as const,
        };
  if (mode === "apiKey" && !params.apiKey) {
    throw new Error("API key is required.");
  }

  const result = await requestAppServer<AccountLoginStartResponse>({
    method: "account/login/start",
    params,
  });
  return result ?? {};
}

export async function logoutAccount() {
  const result = await requestAppServer({
    method: "account/logout",
    params: {},
  });
  return result;
}
