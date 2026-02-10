import type { AppServerNotification } from "@/app/services/cli/appServerPayload";
import { getObject, getString } from "@/app/services/cli/appServerPayload";

export interface ConfigWarningRangePosition {
  line: number;
  column: number;
}

export interface ConfigWarningRange {
  start: ConfigWarningRangePosition;
  end: ConfigWarningRangePosition;
}

export interface ConfigWarningEntry {
  summary: string;
  details: string | null;
  path?: string;
  range?: ConfigWarningRange;
}

const warnings: ConfigWarningEntry[] = [];
const listeners = new Set<() => void>();
const MAX_WARNINGS = 50;

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

function readRangePosition(
  value: Record<string, unknown> | undefined,
): ConfigWarningRangePosition | null {
  if (!value) {
    return null;
  }
  const line = value.line;
  const column = value.column;
  if (typeof line !== "number" || typeof column !== "number") {
    return null;
  }
  if (Number.isNaN(line) || Number.isNaN(column)) {
    return null;
  }
  return {
    line,
    column,
  };
}

function readRange(params: Record<string, unknown> | undefined) {
  const range = getObject(params ?? {}, "range");
  if (!range) {
    return undefined;
  }
  const start = readRangePosition(getObject(range, "start"));
  const end = readRangePosition(getObject(range, "end"));
  if (!start || !end) {
    return undefined;
  }
  return {
    start,
    end,
  } satisfies ConfigWarningRange;
}

function warningKey(entry: ConfigWarningEntry) {
  const rangeKey = entry.range
    ? `${entry.range.start.line}:${entry.range.start.column}-${entry.range.end.line}:${entry.range.end.column}`
    : "";
  return [entry.summary, entry.details ?? "", entry.path ?? "", rangeKey].join(
    "|",
  );
}

function upsertWarning(entry: ConfigWarningEntry) {
  const key = warningKey(entry);
  const existingIndex = warnings.findIndex(
    (warning) => warningKey(warning) === key,
  );
  if (existingIndex >= 0) {
    warnings.splice(existingIndex, 1);
  }
  warnings.unshift(entry);
  if (warnings.length > MAX_WARNINGS) {
    warnings.length = MAX_WARNINGS;
  }
}

export function registerConfigWarningNotification(
  notification: AppServerNotification,
) {
  if (notification.method !== "configWarning") {
    return;
  }
  const params = notification.params ?? {};
  const summary = getString(params, "summary");
  if (!summary) {
    return;
  }
  const detailsValue = params.details;
  const details = typeof detailsValue === "string" ? detailsValue : null;
  const path = getString(params, "path");
  const range = readRange(params);
  upsertWarning({
    summary,
    details,
    path,
    range,
  });
  emit();
}

export function subscribeConfigWarnings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConfigWarnings() {
  return [...warnings];
}

export function clearConfigWarnings() {
  if (!warnings.length) {
    return;
  }
  warnings.length = 0;
  emit();
}
