import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadAuthStatus,
  loadMcpServerStatuses,
  loadMergedConfig,
  mcpServersFromConfig,
  providersFromConfig,
  reloadMcpServerConnections,
  startMcpServerOauthLogin,
} from "@/app/services/cli/config";
import { requestAppServer } from "@/app/services/cli/rpc";

vi.mock("@/app/services/cli/rpc", () => ({
  requestAppServer: vi.fn(),
}));

describe("config service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads merged config from app-server and falls back to an empty object", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      config: {
        model: "gpt-5-codex",
      },
    });
    requestMock.mockResolvedValueOnce({
      config: ["invalid"],
    });

    await expect(loadMergedConfig("C:/repo/theoden")).resolves.toEqual({
      model: "gpt-5-codex",
    });
    await expect(loadMergedConfig()).resolves.toEqual({});
    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "config/read",
      params: {
        includeLayers: false,
        cwd: "C:/repo/theoden",
      },
    });
  });

  it("maps MCP server config and runtime statuses", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      data: [
        { name: "buildkite", authStatus: "NotLoggedIn" },
        { name: "github", authStatus: "oauth" },
        { name: "legacy", status: "OFFLINE" },
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
        authStatus: "unknown",
      },
      {
        id: "github_actions",
        name: "github actions",
        endpoint: "https://mcp.example",
        status: "connected",
        authStatus: "unknown",
      },
      {
        id: "fallback_only",
        name: "fallback only",
        endpoint: "mcp://fallback_only",
        status: "connected",
        authStatus: "unknown",
      },
    ]);

    await expect(loadMcpServerStatuses()).resolves.toEqual([
      { id: "buildkite", status: "needs_auth", authStatus: "notLoggedIn" },
      { id: "github", status: "connected", authStatus: "oauth" },
      { id: "legacy", status: "disabled", authStatus: "unknown" },
    ]);
  });

  it("starts MCP OAuth login and reloads MCP connections", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      authorization_url: "https://example.test/oauth",
    });
    requestMock.mockResolvedValueOnce({
      ok: true,
    });

    await expect(startMcpServerOauthLogin("github")).resolves.toEqual({
      name: "github",
      authorizationUrl: "https://example.test/oauth",
    });
    await expect(reloadMcpServerConnections()).resolves.toEqual({
      ok: true,
    });

    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: "mcpServer/oauth/login",
      params: {
        name: "github",
        scopes: undefined,
        timeoutSecs: undefined,
      },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: "config/mcpServer/reload",
    });
  });

  it("maps auth status and provider readiness from config variants", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      authStatus: "authenticated",
    });

    await expect(loadAuthStatus()).resolves.toEqual({
      status: "authenticated",
      requiresOpenaiAuth: null,
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
