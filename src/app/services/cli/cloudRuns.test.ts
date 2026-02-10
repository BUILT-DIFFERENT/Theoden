import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCloudRunsModule() {
  vi.resetModules();
  const runCliMock = vi.fn().mockResolvedValue({
    code: 0,
    stdout: "https://cloud.example/tasks/task-123\n",
    stderr: "",
  });
  const listCloudTasksMock = vi
    .fn()
    .mockResolvedValue({ tasks: [], cursor: null });

  vi.doMock("@/app/services/cli/runner", () => ({
    runCli: runCliMock,
  }));
  vi.doMock("@/app/services/cli/cloudTasks", () => ({
    listCloudTasks: listCloudTasksMock,
  }));

  const mod = await import("@/app/services/cli/cloudRuns");
  return { mod, runCliMock, listCloudTasksMock };
}

describe("cloudRuns service", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("times out cloud polling and marks the run as failed", async () => {
    vi.useFakeTimers();
    const { mod, runCliMock, listCloudTasksMock } = await loadCloudRunsModule();

    await mod.startCloudRun({
      threadId: "thread-timeout",
      prompt: "Run checks",
      environmentId: "env-a",
    });

    expect(runCliMock).toHaveBeenCalledTimes(1);
    expect(mod.hasActiveCloudRun("thread-timeout")).toBe(true);

    await vi.advanceTimersByTimeAsync(120000);
    await Promise.resolve();

    expect(listCloudTasksMock).toHaveBeenCalled();
    expect(mod.hasActiveCloudRun("thread-timeout")).toBe(false);
    const events = mod.cloudRunEvents("thread-timeout");
    expect(events.at(-1)).toMatchObject({
      label: "Cloud task polling timed out",
      status: "failed",
    });
    expect(events.at(-1)?.detail).toContain("120s");
  });
});
