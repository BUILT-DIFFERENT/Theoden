import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { isTauri } from "@/app/utils/tauri";

export interface HostCloudRunDescriptor {
  runId: string;
  threadId: string;
  taskId: string | null;
  url: string | null;
  environmentId: string;
  branch: string | null;
  attempts: number;
  cwd: string | null;
  status: "queued" | "running" | "completed" | "failed" | "interrupted";
  startedAt: number;
  updatedAt: number;
}

export interface HostCloudRunStatusEvent {
  runId: string;
  threadId: string;
  status: HostCloudRunDescriptor["status"];
  detail: string | null;
  taskId: string | null;
  url: string | null;
  updatedAt: number;
}

export interface HostCloudRunOutputEvent {
  runId: string;
  threadId: string;
  stream: "stdout" | "stderr";
  data: string;
  updatedAt: number;
}

export interface HostCloudRunCompletedEvent {
  runId: string;
  threadId: string;
  status: HostCloudRunDescriptor["status"];
  code: number;
  error: string | null;
  taskId: string | null;
  url: string | null;
  completedAt: number;
}

export async function startHostCloudRun(params: {
  threadId: string;
  prompt: string;
  environmentId: string;
  branch?: string;
  attempts?: number;
  cwd?: string;
}) {
  return invoke<HostCloudRunDescriptor>("cloud_run_start", {
    params: {
      threadId: params.threadId,
      prompt: params.prompt,
      environmentId: params.environmentId,
      branch: params.branch ?? null,
      attempts: params.attempts ?? null,
      cwd: params.cwd ?? null,
    },
  });
}

export async function cancelHostCloudRun(params: {
  runId?: string | null;
  threadId?: string | null;
}) {
  return invoke<boolean>("cloud_run_cancel", {
    params: {
      runId: params.runId ?? null,
      threadId: params.threadId ?? null,
    },
  });
}

export async function listHostCloudRuns() {
  if (!isTauri()) {
    return [] as HostCloudRunDescriptor[];
  }
  return invoke<HostCloudRunDescriptor[]>("cloud_run_list");
}

export async function subscribeHostCloudRunEvents(handlers: {
  onStarted?: (event: HostCloudRunDescriptor) => void;
  onStatus?: (event: HostCloudRunStatusEvent) => void;
  onOutput?: (event: HostCloudRunOutputEvent) => void;
  onCompleted?: (event: HostCloudRunCompletedEvent) => void;
}) {
  if (!isTauri()) {
    return () => {};
  }
  const [unlistenStarted, unlistenStatus, unlistenOutput, unlistenCompleted] =
    await Promise.all([
      listen<HostCloudRunDescriptor>("cloud-run-started", (event) =>
        handlers.onStarted?.(event.payload),
      ),
      listen<HostCloudRunStatusEvent>("cloud-run-status", (event) =>
        handlers.onStatus?.(event.payload),
      ),
      listen<HostCloudRunOutputEvent>("cloud-run-output", (event) =>
        handlers.onOutput?.(event.payload),
      ),
      listen<HostCloudRunCompletedEvent>("cloud-run-completed", (event) =>
        handlers.onCompleted?.(event.payload),
      ),
    ]);
  return () => {
    unlistenStarted();
    unlistenStatus();
    unlistenOutput();
    unlistenCompleted();
  };
}
