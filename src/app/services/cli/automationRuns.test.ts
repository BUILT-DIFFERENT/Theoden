import { describe, expect, it, vi } from "vitest";

import type { AppServerNotification } from "@/app/services/cli/appServerPayload";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function loadAutomationRunsModule(options: {
  isTauri: boolean;
  listImpl?: () => Promise<unknown[]>;
}) {
  vi.resetModules();
  const listMock = vi
    .fn<() => Promise<unknown[]>>()
    .mockImplementation(options.listImpl ?? (() => Promise.resolve([])));

  vi.doMock("@/app/utils/tauri", () => ({
    isTauri: () => options.isTauri,
  }));
  vi.doMock("@/app/services/host/automations", () => ({
    listAutomationRuns: listMock,
  }));

  const mod = await import("@/app/services/cli/automationRuns");
  return { mod, listMock };
}

describe("automationRuns service", () => {
  it("refreshes runs on subscribe and filters by automation id", async () => {
    const runs = [
      {
        id: "run-1",
        automationId: "automation-a",
      },
      {
        id: "run-2",
        automationId: "automation-b",
      },
    ];
    const { mod, listMock } = await loadAutomationRunsModule({
      isTauri: true,
      listImpl: () => Promise.resolve(runs),
    });
    const listener = vi.fn();

    const unsubscribe = mod.subscribeAutomationRuns(listener);
    await Promise.resolve();
    await Promise.resolve();

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mod.getAutomationRuns()).toEqual(runs);
    expect(mod.getAutomationRuns("automation-a")).toEqual([runs[0]]);
    unsubscribe();
  });

  it("deduplicates concurrent refreshes and refreshes for supported notifications", async () => {
    const inFlight = deferred<unknown[]>();
    const { mod, listMock } = await loadAutomationRunsModule({
      isTauri: true,
      listImpl: () => inFlight.promise,
    });

    mod.subscribeAutomationRuns(() => {});
    mod.recordAutomationRunStart();
    mod.recordAutomationRunFailure();
    mod.registerAutomationRunNotification({
      method: "item/completed",
      params: {},
    } satisfies AppServerNotification);

    expect(listMock).toHaveBeenCalledTimes(1);

    inFlight.resolve([]);
    await Promise.resolve();
    await Promise.resolve();

    mod.registerAutomationRunNotification({
      method: "turn/completed",
      params: {},
    } satisfies AppServerNotification);
    await Promise.resolve();

    expect(listMock).toHaveBeenCalledTimes(2);

    mod.registerAutomationRunNotification({
      method: "thread/read",
      params: {},
    } satisfies AppServerNotification);
    await Promise.resolve();

    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("returns empty runs in non-tauri mode without host calls", async () => {
    const { mod, listMock } = await loadAutomationRunsModule({
      isTauri: false,
    });
    const listener = vi.fn();

    mod.subscribeAutomationRuns(listener);
    await Promise.resolve();

    expect(listMock).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mod.getAutomationRuns()).toEqual([]);
  });
});
