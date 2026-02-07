import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { isTauri } from "@/app/utils/tauri";

export interface HostAutomationRecord {
  id: string;
  name: string;
  prompt: string;
  status: string;
  nextRunAt: number | null;
  lastRunAt: number | null;
  cwds: string[];
  rrule: string;
  createdAt: number;
  updatedAt: number;
}

export interface HostAutomationRunRecord {
  id: string;
  threadId: string;
  automationId: string;
  status: string;
  readAt: number | null;
  threadTitle: string | null;
  sourceCwd: string | null;
  inboxTitle: string | null;
  inboxSummary: string | null;
  createdAt: number;
  updatedAt: number;
  archivedUserMessage: string | null;
  archivedAssistantMessage: string | null;
  archivedReason: string | null;
}

export interface HostInboxItem {
  id: string;
  title: string;
  description: string;
  threadId: string;
  readAt: number | null;
  createdAt: number;
}

export interface HostAutomationCreateParams {
  name: string;
  prompt: string;
  status?: string;
  nextRunAt: number | null;
  lastRunAt: number | null;
  cwds: string[];
  rrule: string;
}

export interface HostAutomationUpdateParams {
  id: string;
  name?: string;
  prompt?: string;
  status?: string;
  nextRunAt?: number | null;
  lastRunAt?: number | null;
  cwds?: string[];
  rrule?: string;
}

export async function listAutomations(): Promise<HostAutomationRecord[]> {
  if (!isTauri()) {
    return [];
  }
  return invoke<HostAutomationRecord[]>("automation_list");
}

export async function createAutomation(
  params: HostAutomationCreateParams,
): Promise<HostAutomationRecord> {
  return invoke<HostAutomationRecord>("automation_create", { params });
}

export async function updateAutomation(
  params: HostAutomationUpdateParams,
): Promise<HostAutomationRecord> {
  return invoke<HostAutomationRecord>("automation_update", { params });
}

export async function deleteAutomation(id: string) {
  await invoke("automation_delete", { id });
}

export async function runAutomationNow(automationId: string) {
  return invoke<HostAutomationRunRecord>("automation_run_now", {
    params: { automationId },
  });
}

export async function listAutomationRuns(automationId?: string | null) {
  return invoke<HostAutomationRunRecord[]>("automation_runs_list", {
    params: {
      automationId: automationId ?? null,
    },
  });
}

export async function archiveAutomationRun(
  runId: string,
  reason?: string | null,
) {
  await invoke("automation_run_archive", {
    params: {
      runId,
      reason: reason ?? null,
    },
  });
}

export async function listInboxItems() {
  return invoke<HostInboxItem[]>("inbox_items");
}

export async function markInboxRead(id: string) {
  await invoke("inbox_mark_read", { params: { id } });
}

export async function subscribeAutomationStoreUpdates(listener: () => void) {
  if (!isTauri()) {
    return () => {};
  }
  const [unlistenAutomations, unlistenRuns, unlistenInbox] = await Promise.all([
    listen("automations-updated", () => listener()),
    listen("automation-runs-updated", () => listener()),
    listen("inbox-items-updated", () => listener()),
  ]);
  return () => {
    unlistenAutomations();
    unlistenRuns();
    unlistenInbox();
  };
}
