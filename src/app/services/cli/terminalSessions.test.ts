import { describe, expect, it, vi } from "vitest";

import type { AppServerNotification } from "@/app/services/cli/appServerPayload";

interface LoadTerminalModuleOptions {
  isTauri: boolean;
  listSessions?: Array<{
    sessionId: string;
    threadId: string | null;
    workspacePath: string | null;
    cwd: string | null;
    isRunning: boolean;
    updatedAt: number;
  }>;
}

async function loadTerminalSessionsModule(options: LoadTerminalModuleOptions) {
  vi.resetModules();

  const listTerminalSessions = vi
    .fn()
    .mockResolvedValue(options.listSessions ?? []);
  const createTerminalSession = vi.fn().mockResolvedValue({
    sessionId: "session-created",
    threadId: "thread-1",
    workspacePath: "C:/repo/project",
    cwd: "C:/repo/project",
    isRunning: false,
    updatedAt: 101,
  });
  const attachTerminalSession = vi.fn().mockResolvedValue({
    sessionId: "session-existing",
    threadId: "thread-1",
    workspacePath: null,
    cwd: null,
    isRunning: true,
    updatedAt: 99,
  });
  const writeTerminalSession = vi.fn().mockResolvedValue(undefined);
  const closeTerminalSession = vi.fn().mockResolvedValue(undefined);
  let subscribedHandlers: {
    onAttached?: (payload: {
      sessionId: string;
      threadId: string | null;
      workspacePath: string | null;
      cwd: string | null;
      isRunning: boolean;
      updatedAt: number;
    }) => void;
    onData?: (payload: {
      sessionId: string;
      stream: "stdin" | "stdout" | "stderr";
      data: string;
    }) => void;
    onExit?: (payload: { sessionId: string; code: number }) => void;
    onError?: (payload: { sessionId: string; error: string }) => void;
  } | null = null;
  const subscribeTerminalEvents = vi
    .fn()
    .mockImplementation((next: NonNullable<typeof subscribedHandlers>) => {
      subscribedHandlers = next;
      return Promise.resolve(() => {});
    });

  vi.doMock("@/app/utils/tauri", () => ({
    isTauri: () => options.isTauri,
  }));
  vi.doMock("@/app/services/host/terminal", () => ({
    listTerminalSessions,
    createTerminalSession,
    attachTerminalSession,
    subscribeTerminalEvents,
    writeTerminalSession,
    resizeTerminalSession: vi.fn().mockResolvedValue(undefined),
    closeTerminalSession,
  }));

  const mod = await import("@/app/services/cli/terminalSessions");
  return {
    mod,
    mocks: {
      listTerminalSessions,
      createTerminalSession,
      attachTerminalSession,
      subscribeTerminalEvents,
      writeTerminalSession,
      closeTerminalSession,
      getHandlers: () => subscribedHandlers,
    },
  };
}

describe("terminalSessions service", () => {
  it("records command failure in non-tauri mode", async () => {
    const { mod } = await loadTerminalSessionsModule({
      isTauri: false,
    });

    await expect(
      mod.runTerminalCommand({ threadId: "thread-1" }, "pnpm lint"),
    ).rejects.toThrow("Terminal commands are available in the desktop app.");

    const session = mod.getTerminalSession({ threadId: "thread-1" });
    expect(session.isRunning).toBe(false);
    expect(session.entries.map((entry) => entry.text)).toEqual([
      "$ pnpm lint",
      "Terminal commands are available in the desktop app.",
    ]);
    expect(session.entries.map((entry) => entry.kind)).toEqual([
      "input",
      "stderr",
    ]);
  });

  it("reuses existing host sessions and consumes host stream events", async () => {
    const { mod, mocks } = await loadTerminalSessionsModule({
      isTauri: true,
      listSessions: [
        {
          sessionId: "session-existing",
          threadId: "thread-1",
          workspacePath: null,
          cwd: null,
          isRunning: true,
          updatedAt: 50,
        },
      ],
    });

    await mod.runTerminalCommand({ threadId: "thread-1" }, "echo hello");

    expect(mocks.listTerminalSessions).toHaveBeenCalledTimes(1);
    expect(mocks.attachTerminalSession).toHaveBeenCalledWith(
      "session-existing",
    );
    expect(mocks.createTerminalSession).not.toHaveBeenCalled();
    expect(mocks.writeTerminalSession).toHaveBeenCalledWith(
      "session-existing",
      "echo hello",
    );

    const handlers = mocks.getHandlers();
    handlers?.onData?.({
      sessionId: "session-existing",
      stream: "stdout",
      data: "hello",
    });
    handlers?.onError?.({
      sessionId: "session-existing",
      error: "stderr line",
    });
    handlers?.onExit?.({
      sessionId: "session-existing",
      code: 0,
    });

    const session = mod.getTerminalSession({ threadId: "thread-1" });
    expect(session.isRunning).toBe(false);
    expect(session.entries.map((entry) => entry.text)).toContain("hello");
    expect(session.entries.map((entry) => entry.text)).toContain("stderr line");
    expect(session.entries.map((entry) => entry.text)).toContain(
      "command exited with 0",
    );
  });

  it("maps command notifications into input, streamed output, and completion state", async () => {
    const { mod } = await loadTerminalSessionsModule({
      isTauri: false,
    });

    mod.registerTerminalNotification({
      method: "item/started",
      params: {
        threadId: "thread-42",
        item: {
          type: "commandExecution",
          command: "pnpm app:test",
        },
      },
    } satisfies AppServerNotification);

    mod.registerTerminalNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-42",
        itemId: "item-1",
        delta: "line-1",
      },
    } satisfies AppServerNotification);
    mod.registerTerminalNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-42",
        itemId: "item-1",
        delta: "line-2",
      },
    } satisfies AppServerNotification);

    mod.registerTerminalNotification({
      method: "item/completed",
      params: {
        threadId: "thread-42",
        item: {
          id: "item-1",
          type: "commandExecution",
          status: "completed",
          exitCode: 0,
          aggregatedOutput: "this should be ignored because stream exists",
        },
      },
    } satisfies AppServerNotification);

    mod.registerTerminalNotification({
      method: "item/completed",
      params: {
        threadId: "thread-42",
        item: {
          id: "item-2",
          type: "commandExecution",
          status: "failed",
          aggregatedOutput: "first line\nsecond line",
        },
      },
    } satisfies AppServerNotification);

    const session = mod.getTerminalSession({ threadId: "thread-42" });
    expect(session.entries.map((entry) => entry.text)).toEqual([
      "$ pnpm app:test",
      "line-1line-2",
      "command completed (exit 0)",
      "first line",
      "second line",
      "command failed",
    ]);
  });

  it("clears terminal session and closes mapped host session", async () => {
    const { mod, mocks } = await loadTerminalSessionsModule({
      isTauri: true,
      listSessions: [],
    });

    await mod.runTerminalCommand(
      { threadId: "thread-1", workspacePath: "C:/repo/project/" },
      "pnpm lint",
    );
    expect(mocks.createTerminalSession).toHaveBeenCalledTimes(1);

    await mod.clearTerminalSession({
      threadId: "thread-1",
      workspacePath: "C:/repo/project/",
    });

    expect(mocks.closeTerminalSession).toHaveBeenCalledWith("session-created");
    const session = mod.getTerminalSession({
      threadId: "thread-1",
      workspacePath: "C:/repo/project/",
    });
    expect(session.entries).toEqual([]);
    expect(session.isRunning).toBe(false);
  });
});
