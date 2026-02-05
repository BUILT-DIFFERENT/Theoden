export type JsonObject = Record<string, unknown>;

export interface AppServerNotification {
  method: string;
  params?: JsonObject;
}

export interface AppServerRequest {
  id: string | number;
  method: string;
  params?: JsonObject;
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getString(record: JsonObject, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function getObject(
  record: JsonObject,
  key: string,
): JsonObject | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

export function getArray(
  record: JsonObject,
  key: string,
): unknown[] | undefined {
  const value = record[key];
  return Array.isArray(value) ? value : undefined;
}

export function getStringArray(
  record: JsonObject,
  key: string,
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  if (!value.every((entry) => typeof entry === "string")) return undefined;
  return value;
}

export function parseAppServerNotification(
  payload: unknown,
): AppServerNotification | null {
  if (!isRecord(payload)) return null;
  const method = payload.method;
  if (typeof method !== "string") return null;
  const params = isRecord(payload.params) ? payload.params : undefined;
  return { method, params };
}

export function parseAppServerRequest(
  payload: unknown,
): AppServerRequest | null {
  if (!isRecord(payload)) return null;
  const method = payload.method;
  if (typeof method !== "string") return null;
  const id = payload.id;
  if (typeof id !== "string" && typeof id !== "number") return null;
  const params = isRecord(payload.params) ? payload.params : undefined;
  return { id, method, params };
}
