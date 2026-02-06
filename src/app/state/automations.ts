const AUTOMATIONS_STORAGE_KEY = "codex.automations";
const LEGACY_AUTOMATIONS_STORAGE_KEY = "theoden.automations";

export const automationRecurrenceOptions = [
  "daily",
  "weekly",
  "monthly",
] as const;

export type AutomationRecurrenceKind =
  (typeof automationRecurrenceOptions)[number];

export interface AutomationRecurrence {
  kind: AutomationRecurrenceKind;
  time: string;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}

export interface AutomationItem {
  id: string;
  name: string;
  workspacePath: string;
  prompt: string;
  recurrence: AutomationRecurrence;
  createdAt: number;
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function createDefaultRecurrence(): AutomationRecurrence {
  return {
    kind: "daily",
    time: "09:00",
    timezone: localTimezone(),
    dayOfWeek: null,
    dayOfMonth: null,
  };
}

export function isAutomationRecurrenceKind(
  value: string,
): value is AutomationRecurrenceKind {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function parseTimeParts(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

function isValidDayOfWeek(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 6;
}

function isValidDayOfMonth(value: unknown): value is number {
  return typeof value === "number" && value >= 1 && value <= 31;
}

function isAutomationRecurrence(value: unknown): value is AutomationRecurrence {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (!isAutomationRecurrenceKind(String(candidate.kind))) {
    return false;
  }
  if (typeof candidate.time !== "string" || !parseTimeParts(candidate.time)) {
    return false;
  }
  if (typeof candidate.timezone !== "string" || !candidate.timezone.trim()) {
    return false;
  }
  const dayOfWeek = candidate.dayOfWeek;
  const dayOfMonth = candidate.dayOfMonth;
  if (
    dayOfWeek !== null &&
    dayOfWeek !== undefined &&
    !isValidDayOfWeek(dayOfWeek)
  ) {
    return false;
  }
  if (
    dayOfMonth !== null &&
    dayOfMonth !== undefined &&
    !isValidDayOfMonth(dayOfMonth)
  ) {
    return false;
  }
  if (candidate.kind === "weekly" && !isValidDayOfWeek(dayOfWeek)) {
    return false;
  }
  if (candidate.kind === "monthly" && !isValidDayOfMonth(dayOfMonth)) {
    return false;
  }
  return true;
}

function parseLegacyRecurrence(value: Record<string, unknown>) {
  const recurrence = value.recurrence;
  const runTime = typeof value.runTime === "string" ? value.runTime : "09:00";
  const legacyRecurrence =
    recurrence === "Daily"
      ? "daily"
      : recurrence === "Weekly"
        ? "weekly"
        : recurrence === "Monthly"
          ? "monthly"
          : null;
  if (!legacyRecurrence) {
    return null;
  }
  const base = {
    kind: legacyRecurrence,
    time: parseTimeParts(runTime) ? runTime : "09:00",
    timezone: localTimezone(),
    dayOfWeek: legacyRecurrence === "weekly" ? 1 : null,
    dayOfMonth: legacyRecurrence === "monthly" ? 1 : null,
  } satisfies AutomationRecurrence;
  return base;
}

function isAutomationItem(value: unknown): value is AutomationItem {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.workspacePath !== "string" ||
    typeof candidate.prompt !== "string" ||
    typeof candidate.createdAt !== "number"
  ) {
    return false;
  }
  if (!isAutomationRecurrence(candidate.recurrence)) {
    return false;
  }
  const { lastRunAt, nextRunAt } = candidate;
  if (
    lastRunAt !== null &&
    lastRunAt !== undefined &&
    typeof lastRunAt !== "number"
  ) {
    return false;
  }
  if (
    nextRunAt !== null &&
    nextRunAt !== undefined &&
    typeof nextRunAt !== "number"
  ) {
    return false;
  }
  return true;
}

function migrateLegacyItem(value: unknown): AutomationItem | null {
  if (typeof value !== "object" || !value) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.workspacePath !== "string" ||
    typeof candidate.prompt !== "string" ||
    typeof candidate.createdAt !== "number" ||
    typeof candidate.enabled !== "boolean"
  ) {
    return null;
  }
  const recurrence = parseLegacyRecurrence(candidate);
  if (!recurrence) {
    return null;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    workspacePath: candidate.workspacePath,
    prompt: candidate.prompt,
    recurrence,
    createdAt: candidate.createdAt,
    enabled: candidate.enabled,
    lastRunAt: null,
    nextRunAt: computeNextRunAt(recurrence, candidate.createdAt),
  };
}

export function computeNextRunAt(
  recurrence: AutomationRecurrence,
  fromTimestamp = Date.now(),
) {
  const timeParts = parseTimeParts(recurrence.time);
  if (!timeParts) {
    return null;
  }
  const next = new Date(fromTimestamp);
  next.setSeconds(0, 0);
  next.setHours(timeParts.hour, timeParts.minute, 0, 0);

  if (recurrence.kind === "daily") {
    if (next.getTime() <= fromTimestamp) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }

  if (recurrence.kind === "weekly") {
    const targetDay = recurrence.dayOfWeek ?? 1;
    const currentDay = next.getDay();
    let delta = targetDay - currentDay;
    if (delta < 0) {
      delta += 7;
    }
    if (delta === 0 && next.getTime() <= fromTimestamp) {
      delta = 7;
    }
    next.setDate(next.getDate() + delta);
    return next.getTime();
  }

  const targetDay = recurrence.dayOfMonth ?? 1;
  const year = next.getFullYear();
  const month = next.getMonth();
  const monthEndDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, monthEndDay);
  next.setDate(clampedDay);
  if (next.getTime() <= fromTimestamp) {
    const nextMonth = month + 1;
    const nextMonthEndDay = new Date(year, nextMonth + 1, 0).getDate();
    next.setMonth(nextMonth, Math.min(targetDay, nextMonthEndDay));
  }
  return next.getTime();
}

export function formatAutomationSchedule(recurrence: AutomationRecurrence) {
  const time = recurrence.time;
  if (recurrence.kind === "daily") {
    return `Daily at ${time}`;
  }
  if (recurrence.kind === "weekly") {
    const dayLabel = weekdayLabelFromIndex(recurrence.dayOfWeek ?? 1);
    return `Weekly on ${dayLabel} at ${time}`;
  }
  return `Monthly on day ${recurrence.dayOfMonth ?? 1} at ${time}`;
}

export function weekdayLabelFromIndex(day: number) {
  const labels = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return labels[day] ?? labels[1];
}

export function formatAutomationTimestamp(value: number | null) {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function loadStoredAutomations(): AutomationItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw =
      window.localStorage.getItem(AUTOMATIONS_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_AUTOMATIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const automations = parsed
      .map((item) => {
        if (isAutomationItem(item)) {
          return item;
        }
        return migrateLegacyItem(item);
      })
      .filter((item): item is AutomationItem => item !== null);
    if (!window.localStorage.getItem(AUTOMATIONS_STORAGE_KEY)) {
      window.localStorage.setItem(
        AUTOMATIONS_STORAGE_KEY,
        JSON.stringify(automations),
      );
    }
    return automations;
  } catch (error) {
    console.warn("Failed to load stored automations", error);
    return [];
  }
}

export function storeAutomations(automations: AutomationItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      AUTOMATIONS_STORAGE_KEY,
      JSON.stringify(automations),
    );
  } catch (error) {
    console.warn("Failed to store automations", error);
  }
}
