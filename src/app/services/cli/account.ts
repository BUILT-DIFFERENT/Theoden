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
  login_id?: string;
  auth_url?: string;
  [key: string]: unknown;
}

interface AccountLoginCancelResponse {
  status?: string;
}

export type AccountLoginStartResult =
  | {
      type: "apiKey";
    }
  | {
      type: "chatgpt";
      loginId: string;
      authUrl: string;
    }
  | {
      type: "chatgptAuthTokens";
    };

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
): Promise<AccountLoginStartResult> {
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
  const type = readResponseType(result, mode);
  if (type === "chatgpt") {
    const loginId =
      result?.loginId ??
      (typeof result?.login_id === "string" ? result.login_id : null);
    const authUrl =
      result?.authUrl ??
      (typeof result?.auth_url === "string" ? result.auth_url : null);
    if (!loginId || !authUrl) {
      throw new Error("ChatGPT login start did not return login metadata.");
    }
    return {
      type,
      loginId,
      authUrl,
    };
  }
  if (type === "chatgptAuthTokens") {
    return { type };
  }
  return { type: "apiKey" };
}

export async function logoutAccount() {
  const result = await requestAppServer({
    method: "account/logout",
    params: {},
  });
  return result;
}

export async function cancelAccountLogin(loginId: string) {
  const trimmed = loginId.trim();
  if (!trimmed) {
    throw new Error("Login id is required.");
  }
  const result = await requestAppServer<AccountLoginCancelResponse>({
    method: "account/login/cancel",
    params: {
      loginId: trimmed,
    },
  });
  const status = result?.status;
  if (typeof status === "string") {
    return status;
  }
  return "canceled";
}

function readResponseType(
  result: AccountLoginStartResponse | undefined,
  fallbackMode: "chatgpt" | "apiKey",
): AccountLoginStartResult["type"] {
  const type = typeof result?.type === "string" ? result.type : null;
  if (type === "chatgpt" || type === "apiKey" || type === "chatgptAuthTokens") {
    return type;
  }
  return fallbackMode === "chatgpt" ? "chatgpt" : "apiKey";
}
