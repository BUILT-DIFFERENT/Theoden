import {
  getString,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";

const diffs = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeDiffs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDiffText(threadId?: string) {
  if (!threadId) return undefined;
  return diffs.get(threadId);
}

export function registerDiffNotification(notification: AppServerNotification) {
  if (notification.method !== "turn/diff/updated") return;
  const params = notification.params;
  if (!params) return;
  const threadId = getString(params, "threadId");
  const diff = getString(params, "diff");
  if (!threadId || diff == null) return;
  diffs.set(threadId, diff);
  emit();
}
