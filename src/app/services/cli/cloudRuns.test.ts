import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCloudRunsModule() {
  vi.resetModules();

  const startHostCloudRun = vi.fn().mockResolvedValue({
    runId: "run-1",
    threadId: "thread-1",
    taskId: "task-1",
    url: "https://cloud.example/tasks/task-1",
    environmentId: "env-a",
    branch: "main",
    attempts: 2,
    cwd: "/repo",
    status: "queued",
    startedAt: 1,
    updatedAt: 1,
  });
  const cancelHostCloudRun = vi.fn().mockResolvedValue(true);
  const listHostCloudRuns = vi.fn().mockResolvedValue([]);
  let handlers: {
    onStarted?: (event: Record<string, unknown>) => void;
    onStatus?: (event: Record<string, unknown>) => void;
    onOutput?: (event: Record<string, unknown>) => void;
    onCompleted?: (event: Record<string, unknown>) => void;
  } | null = null;
  const subscribeHostCloudRunEvents = vi.fn().mockImplementation(
    (
      next: NonNullable<{
        onStarted?: (event: Record<string, unknown>) => void;
        onStatus?: (event: Record<string, unknown>) => void;
        onOutput?: (event: Record<string, unknown>) => void;
        onCompleted?: (event: Record<string, unknown>) => void;
      }>,
    ) => {
      handlers = next;
      return Promise.resolve(() => {});
    },
  );

  vi.doMock("@/app/utils/tauri", () => ({
    isTauri: () => true,
  }));
  vi.doMock("@/app/services/host/cloudRuns", () => ({
    startHostCloudRun,
    cancelHostCloudRun,
    listHostCloudRuns,
    subscribeHostCloudRunEvents,
  }));

  const mod = await import("@/app/services/cli/cloudRuns");
  return {
    mod,
    mocks: {
      startHostCloudRun,
      cancelHostCloudRun,
      listHostCloudRuns,
      subscribeHostCloudRunEvents,
      handlers: () => handlers,
    },
  };
}

describe("cloudRuns service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts cloud runs via host lifecycle and records completion", async () => {
    const { mod, mocks } = await loadCloudRunsModule();

    await mod.startCloudRun({
      threadId: "thread-1",
      prompt: "Run checks",
      environmentId: "env-a",
      branch: "main",
      attempts: 2,
      cwd: "/repo",
    });

    expect(mocks.startHostCloudRun).toHaveBeenCalledWith({
      threadId: "thread-1",
      prompt: "Run checks",
      environmentId: "env-a",
      branch: "main",
      attempts: 2,
      cwd: "/repo",
    });
    expect(mod.hasActiveCloudRun("thread-1")).toBe(true);

    mocks.handlers()?.onCompleted?.({
      runId: "run-1",
      threadId: "thread-1",
      status: "completed",
      code: 0,
      error: null,
      taskId: "task-1",
      url: "https://cloud.example/tasks/task-1",
      completedAt: 2,
    });

    expect(mod.hasActiveCloudRun("thread-1")).toBe(false);
    const events = mod.cloudRunEvents("thread-1");
    expect(events.at(-1)).toMatchObject({
      label: "Cloud task completed",
      status: "done",
    });
  });

  it("cancels active cloud runs through host command", async () => {
    const { mod, mocks } = await loadCloudRunsModule();

    await mod.startCloudRun({
      threadId: "thread-1",
      prompt: "Run checks",
      environmentId: "env-a",
    });
    await mod.cancelCloudRun("thread-1");

    expect(mocks.cancelHostCloudRun).toHaveBeenCalledWith({
      runId: "run-1",
      threadId: "thread-1",
    });
    const events = mod.cloudRunEvents("thread-1");
    expect(events.at(-1)).toMatchObject({
      label: "Cloud task interrupted",
      status: "failed",
    });
  });
});
