import type { AutomationSummary } from "@/app/types";

const AUTOMATIONS_STORAGE_KEY = "theoden.automations";

export const automationRecurrenceOptions = [
  "Daily",
  "Weekly",
  "Monthly",
] as const;

export type AutomationRecurrence = (typeof automationRecurrenceOptions)[number];

export interface AutomationItem extends AutomationSummary {
  workspacePath: string;
  prompt: string;
  recurrence: AutomationRecurrence;
  runTime: string;
  createdAt: number;
}

export function isAutomationRecurrence(
  value: string,
): value is AutomationRecurrence {
  return value === "Daily" || value === "Weekly" || value === "Monthly";
}

function isAutomationItem(value: unknown): value is AutomationItem {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.schedule !== "string" ||
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.lastRun !== "string" ||
    typeof candidate.nextRun !== "string" ||
    typeof candidate.workspacePath !== "string" ||
    typeof candidate.prompt !== "string" ||
    typeof candidate.runTime !== "string" ||
    typeof candidate.createdAt !== "number"
  ) {
    return false;
  }
  return (
    typeof candidate.recurrence === "string" &&
    isAutomationRecurrence(candidate.recurrence)
  );
}

export function loadStoredAutomations(): AutomationItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(AUTOMATIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is AutomationItem =>
      isAutomationItem(item),
    );
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
