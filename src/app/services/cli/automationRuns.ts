import type { AppServerNotification } from "@/app/services/cli/appServerPayload";
import { listAutomationRuns } from "@/app/services/host/automations";
import type { AutomationRunRecord } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

const listeners = new Set<() => void>();
let runs: AutomationRunRecord[] = [];
let refreshInFlight: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

async function refreshRuns() {
  if (!isTauri()) {
    runs = [];
    emit();
    return;
  }
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      runs = await listAutomationRuns();
      emit();
    } catch (error) {
      console.warn("Failed to refresh automation runs", error);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function subscribeAutomationRuns(listener: () => void) {
  listeners.add(listener);
  void refreshRuns();
  return () => {
    listeners.delete(listener);
  };
}

export function getAutomationRuns(automationId?: string | null) {
  if (!automationId) {
    return runs;
  }
  return runs.filter((run) => run.automationId === automationId);
}

export function recordAutomationRunStart() {
  void refreshRuns();
  return null;
}

export function recordAutomationRunFailure() {
  void refreshRuns();
}

export function registerAutomationRunNotification(
  notification: AppServerNotification,
) {
  if (
    notification.method === "turn/started" ||
    notification.method === "turn/completed" ||
    notification.method === "thread/started" ||
    notification.method.startsWith("item/")
  ) {
    void refreshRuns();
  }
}

export type { AutomationRunRecord };
