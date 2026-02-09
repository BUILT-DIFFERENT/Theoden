import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadAuthStatus,
  loadConfigSnapshot,
  loadMcpServerStatuses,
  loadMergedConfig,
  mapConfigWriteErrorMessage,
  mcpServersFromConfig,
  providersFromConfig,
  readConfigWriteErrorCode,
  validateConfig,
  writeMcpServerConfig,
} from "@/app/services/cli/config";
import {
  clearConfigWarnings,
  registerConfigWarningNotification,
} from "@/app/services/cli/configWarnings";
import { AppServerRpcError, requestAppServer } from "@/app/services/cli/rpc";

vi.mock("@/app/services/cli/rpc", async () => {
  const actual = await vi.importActual("@/app/services/cli/rpc");
  return {
    ...actual,
    requestAppServer: vi.fn(),
  };
});

describe("config service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigWarnings();
  });

  it("loads structured config and derives user-layer write target", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      config: {
        model: "gpt-5-codex",
      },
      origins: {
        model: {
          name: {
            type: "user",
            file: "C:/Users/gamer/.codex/config.toml",
          },
          version: "sha256:model",
        },
      },
      layers: [
        {
          name: {
            type: "user",
            file: "C:/Users/gamer/.codex/config.toml",
          },
          version: "sha256:user",
          config: {
            model: "gpt-5-codex",
          },
          disabledReason: null,
        },
      ],
    });

    await expect(loadConfigSnapshot("C:/repo/theoden")).resolves.toEqual({
      config: {
        model: "gpt-5-codex",
      },
      origins: {
        model: {
          name: {
            type: "user",
            file: "C:/Users/gamer/.codex/config.toml",
          },
          version: "sha256:model",
        },
      },
      layers: [
        {
          name: {
            type: "user",
            file: "C:/Users/gamer/.codex/config.toml",
          },
          version: "sha256:user",
          config: {
            model: "gpt-5-codex",
          },
          disabledReason: null,
        },
      ],
      writeTarget: {
        filePath: "C:/Users/gamer/.codex/config.toml",
        expectedVersion: "sha256:user",
      },
    });
    expect(requestMock).toHaveBeenCalledWith({
      method: "config/read",
      params: {
        includeLayers: true,
        cwd: "C:/repo/theoden",
      },
    });
  });

  it("loads merged config from structured response and falls back to an empty object", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      config: {
        model: "gpt-5-codex",
      },
      origins: {},
      layers: [],
    });
    requestMock.mockResolvedValueOnce({
      config: ["invalid"],
      origins: {},
      layers: null,
    });

    await expect(loadMergedConfig("C:/repo/theoden")).resolves.toEqual({
      model: "gpt-5-codex",
    });
    await expect(loadMergedConfig()).resolves.toEqual({});
  });

  it("returns validation warnings and errors from read failures", async () => {
    const requestMock = vi.mocked(requestAppServer);
    registerConfigWarningNotification({
      method: "configWarning",
      params: {
        summary: "project config ignored",
        details: "workspace is not trusted",
      },
    });

    requestMock.mockResolvedValueOnce({
      config: {
        model: "gpt-5-codex",
      },
      origins: {},
      layers: [],
    });
    await expect(validateConfig("C:/repo/theoden")).resolves.toEqual({
      valid: true,
      errors: [],
      warnings: [
        {
          summary: "project config ignored",
          details: "workspace is not trusted",
          path: undefined,
          range: undefined,
        },
      ],
      keys: 1,
    });

    requestMock.mockRejectedValueOnce(new Error("invalid toml at line 2"));
    await expect(validateConfig("C:/repo/theoden")).resolves.toEqual({
      valid: false,
      errors: ["invalid toml at line 2"],
      warnings: [
        {
          summary: "project config ignored",
          details: "workspace is not trusted",
          path: undefined,
          range: undefined,
        },
      ],
      keys: 0,
    });
  });

  it("writes MCP server entries through config/batchWrite with write target metadata", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      config: {
        mcp_servers: {},
      },
      origins: {},
      layers: [
        {
          name: {
            type: "user",
            file: "C:/Users/gamer/.codex/config.toml",
          },
          version: "sha256:user",
          config: {},
          disabledReason: null,
        },
      ],
    });
    requestMock.mockResolvedValueOnce({
      status: "ok",
      version: "sha256:next",
      filePath: "C:/Users/gamer/.codex/config.toml",
      overriddenMetadata: null,
    });

    await writeMcpServerConfig({
      serverId: "github",
      value: {
        transport: "stdio",
        command: "npx",
      },
      cwd: "C:/repo/theoden",
    });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "config/read",
      params: {
        includeLayers: true,
        cwd: "C:/repo/theoden",
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: "mcp_servers.github",
            value: {
              transport: "stdio",
              command: "npx",
            },
            mergeStrategy: "replace",
          },
        ],
        filePath: "C:/Users/gamer/.codex/config.toml",
        expectedVersion: "sha256:user",
      },
    });
  });

  it("maps config write error metadata to actionable messages", () => {
    const conflictError = new AppServerRpcError("write failed", {
      code: -32000,
      data: {
        config_write_error_code: "configVersionConflict",
      },
    });
    const unknownError = new AppServerRpcError("request failed", {
      code: -32000,
      data: {},
    });

    expect(readConfigWriteErrorCode(conflictError)).toBe(
      "configVersionConflict",
    );
    expect(mapConfigWriteErrorMessage(conflictError)).toContain(
      "Reload settings",
    );
    expect(mapConfigWriteErrorMessage(unknownError)).toBe("request failed");
  });

  it("maps MCP server config and runtime statuses", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      data: [
        { id: "buildkite", status: "OFFLINE" },
        { name: "github", status: "connected" },
        { id: "", status: "disabled" },
      ],
    });

    expect(
      mcpServersFromConfig({
        mcp_servers: {
          buildkite: { command: "npx buildkite-mcp", enabled: false },
          github_actions: { url: "https://mcp.example", disabled: false },
          fallback_only: {},
        },
      }),
    ).toEqual([
      {
        id: "buildkite",
        name: "buildkite",
        endpoint: "npx buildkite-mcp",
        status: "disabled",
      },
      {
        id: "github_actions",
        name: "github actions",
        endpoint: "https://mcp.example",
        status: "connected",
      },
      {
        id: "fallback_only",
        name: "fallback only",
        endpoint: "mcp://fallback_only",
        status: "connected",
      },
    ]);

    await expect(loadMcpServerStatuses()).resolves.toEqual([
      { id: "buildkite", status: "disabled" },
      { id: "github", status: "connected" },
    ]);
    expect(requestMock).toHaveBeenCalledWith({
      method: "mcpServerStatus/list",
      params: {
        cursor: null,
        limit: 100,
      },
    });
  });

  it("maps auth status and provider readiness from config variants", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      account: {
        type: "chatgpt",
      },
      requiresOpenaiAuth: true,
    });

    await expect(loadAuthStatus()).resolves.toEqual({
      status: "authenticated",
      requiresOpenaiAuth: true,
      authMode: "chatgpt",
    });
    expect(requestMock).toHaveBeenCalledWith({
      method: "account/read",
      params: {
        refreshToken: false,
      },
    });

    expect(
      providersFromConfig({
        model: "gpt-5-codex",
        projects: {
          alpha: {},
        },
        worktree_strategy: "git_worktree",
        cloud_exec: {
          useCloud: true,
          region: "us-east-1",
        },
      }),
    ).toEqual([
      {
        id: "local",
        status: "ready",
        detail: "Configured model: gpt-5-codex",
      },
      {
        id: "worktree",
        status: "ready",
        detail: "Strategy: git_worktree",
      },
      {
        id: "cloud",
        status: "ready",
        detail: "Region: us-east-1",
      },
    ]);

    expect(providersFromConfig({})).toEqual([
      {
        id: "local",
        status: "ready",
        detail: "Connected through app-server config",
      },
      {
        id: "worktree",
        status: "unavailable",
        detail: "Add a workspace to enable worktree runs",
      },
      {
        id: "cloud",
        status: "unavailable",
        detail: "Cloud execution not configured",
      },
    ]);
  });
});
