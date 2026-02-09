import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAccountLogin,
  readAccountRateLimits,
  startAccountLogin,
} from "@/app/services/cli/account";
import { listApps } from "@/app/services/cli/apps";
import {
  batchWriteConfig,
  readConfigRequirements,
  reloadMcpServerConfig,
  startMcpServerOauthLogin,
  writeConfigValue,
} from "@/app/services/cli/config";
import { uploadFeedback } from "@/app/services/cli/feedback";
import { listCollaborationModes, listModels } from "@/app/services/cli/models";
import { startReview } from "@/app/services/cli/review";
import { requestAppServer } from "@/app/services/cli/rpc";
import {
  forkThread,
  listLoadedThreads,
  listThreads,
  readThread,
  rollbackThread,
} from "@/app/services/cli/threads";
import {
  cancelTurn,
  resumeThread,
  startThread,
  startTurn,
} from "@/app/services/cli/turns";

vi.mock("@/app/services/cli/rpc", () => ({
  requestAppServer: vi.fn(),
}));

describe("app-server method coverage wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes thread and turn methods to documented RPC names", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ thread: { id: "thread-1" } })
      .mockResolvedValueOnce({ thread: { id: "thread-2" } })
      .mockResolvedValueOnce({ data: ["thread-1"], nextCursor: null })
      .mockResolvedValueOnce({ thread: { id: "thread-1" } })
      .mockResolvedValueOnce({ thread: { id: "thread-3" } })
      .mockResolvedValueOnce({ thread: { id: "thread-3" } })
      .mockResolvedValueOnce({ turn: { id: "turn-1", status: "inProgress" } })
      .mockResolvedValueOnce({});

    await listThreads({ sortKey: "created_at", archived: true, limit: 5 });
    await readThread("thread-1", true);
    await forkThread("thread-1");
    await listLoadedThreads();
    await rollbackThread({ threadId: "thread-1", numTurns: 2 });
    await startThread({ cwd: "/repo", model: "gpt-5.1-codex" });
    await resumeThread({ threadId: "thread-3" });
    await startTurn({
      threadId: "thread-3",
      input: "Run tests",
      model: "gpt-5.1-codex",
      summary: "concise",
      outputSchema: { type: "object" },
    });
    await cancelTurn({ threadId: "thread-3", turnId: "turn-1" });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "thread/list",
      params: {
        cursor: null,
        limit: 5,
        sortKey: "created_at",
        archived: true,
        modelProviders: null,
        sourceKinds: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: "thread/read",
      params: {
        threadId: "thread-1",
        includeTurns: true,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: "thread/fork",
      params: {
        threadId: "thread-1",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, {
      method: "thread/loaded/list",
      params: {
        cursor: null,
        limit: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(5, {
      method: "thread/rollback",
      params: {
        threadId: "thread-1",
        numTurns: 2,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(6, {
      method: "thread/start",
      params: {
        cwd: "/repo",
        model: "gpt-5.1-codex",
        approvalPolicy: null,
        sandbox: null,
        personality: null,
        dynamicTools: null,
        experimentalRawEvents: false,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(7, {
      method: "thread/resume",
      params: {
        threadId: "thread-3",
        cwd: null,
        model: null,
        approvalPolicy: null,
        sandbox: null,
        personality: null,
        dynamicTools: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(8, {
      method: "turn/start",
      params: {
        threadId: "thread-3",
        input: [{ type: "text", text: "Run tests" }],
        cwd: null,
        approvalPolicy: null,
        sandboxPolicy: null,
        model: "gpt-5.1-codex",
        effort: null,
        summary: "concise",
        personality: null,
        outputSchema: { type: "object" },
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(9, {
      method: "turn/interrupt",
      params: {
        threadId: "thread-3",
        turnId: "turn-1",
      },
    });
  });

  it("routes models, apps, review, feedback, config, and account methods", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({
        turn: { id: "turn-1", status: "inProgress", items: [], error: null },
        reviewThreadId: "thread-1",
      })
      .mockResolvedValueOnce({ threadId: "thread-1" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ authorizationUrl: "https://example.com" })
      .mockResolvedValueOnce({ requirements: null })
      .mockResolvedValueOnce({
        status: "ok",
        version: "1",
        filePath: "/tmp/config.toml",
      })
      .mockResolvedValueOnce({
        status: "ok",
        version: "2",
        filePath: "/tmp/config.toml",
      })
      .mockResolvedValueOnce({ type: "chatgptAuthTokens" })
      .mockResolvedValueOnce({ status: "canceled" })
      .mockResolvedValueOnce({ rateLimits: null });

    await listModels();
    await listCollaborationModes();
    await listApps();
    await startReview({
      threadId: "thread-1",
      delivery: "inline",
      target: { type: "uncommittedChanges" },
    });
    await uploadFeedback({
      classification: "bug",
      includeLogs: true,
      threadId: "thread-1",
    });
    await reloadMcpServerConfig();
    await startMcpServerOauthLogin({ name: "github" });
    await readConfigRequirements();
    await writeConfigValue({
      keyPath: "projects",
      value: {},
      mergeStrategy: "upsert",
    });
    await batchWriteConfig({
      edits: [
        { keyPath: "model", value: "gpt-5.1-codex", mergeStrategy: "replace" },
      ],
    });
    await startAccountLogin("chatgptAuthTokens", {
      idToken: "id-token",
      accessToken: "access-token",
    });
    await cancelAccountLogin("login-id");
    await readAccountRateLimits();

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "model/list",
      params: { cursor: null, limit: null },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: "collaborationMode/list",
      params: { cursor: null, limit: null },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, {
      method: "app/list",
      params: { cursor: null, limit: null },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, {
      method: "review/start",
      params: {
        threadId: "thread-1",
        target: { type: "uncommittedChanges" },
        delivery: "inline",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(5, {
      method: "feedback/upload",
      params: {
        classification: "bug",
        includeLogs: true,
        reason: null,
        threadId: "thread-1",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(6, {
      method: "config/mcpServer/reload",
      params: null,
    });
    expect(requestMock).toHaveBeenNthCalledWith(7, {
      method: "mcpServer/oauth/login",
      params: {
        name: "github",
        scopes: null,
        challenge: null,
        redirectUrl: null,
        port: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(8, {
      method: "configRequirements/read",
      params: {},
    });
    expect(requestMock).toHaveBeenNthCalledWith(9, {
      method: "config/value/write",
      params: {
        keyPath: "projects",
        value: {},
        mergeStrategy: "upsert",
        filePath: null,
        expectedVersion: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(10, {
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: "model",
            value: "gpt-5.1-codex",
            mergeStrategy: "replace",
          },
        ],
        filePath: null,
        expectedVersion: null,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(11, {
      method: "account/login/start",
      params: {
        type: "chatgptAuthTokens",
        idToken: "id-token",
        accessToken: "access-token",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(12, {
      method: "account/login/cancel",
      params: {
        loginId: "login-id",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(13, {
      method: "account/rateLimits/read",
      params: {},
    });
  });
});
