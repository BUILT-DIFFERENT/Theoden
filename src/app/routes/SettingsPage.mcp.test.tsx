import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/app/routes/SettingsPage";
import { registerAuthNotification } from "@/app/services/cli/authNotifications";

const {
  loadMergedConfigMock,
  loadMcpServerStatusesMock,
  loadAuthStatusMock,
  mcpServersFromConfigMock,
  providersFromConfigMock,
  validateConfigMock,
  startMcpServerOauthLoginMock,
  reloadMcpServerConnectionsMock,
} = vi.hoisted(() => ({
  loadMergedConfigMock: vi.fn(),
  loadMcpServerStatusesMock: vi.fn(),
  loadAuthStatusMock: vi.fn(),
  mcpServersFromConfigMock: vi.fn(),
  providersFromConfigMock: vi.fn(),
  validateConfigMock: vi.fn(),
  startMcpServerOauthLoginMock: vi.fn(),
  reloadMcpServerConnectionsMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: unknown;
    className?: string;
  }) => (
    <button type="button" className={className}>
      {children as string}
    </button>
  ),
  useParams: () => ({ section: "mcp-servers" }),
}));

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [{ path: "/repo/theoden", name: "Theoden" }],
    isLoading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}));

vi.mock("@/app/state/workspaceUi", () => ({
  useWorkspaceUi: () => ({
    selectedWorkspace: "/repo/theoden",
    setSelectedWorkspace: vi.fn(),
  }),
}));

vi.mock("@/app/services/cli/config", () => ({
  loadMergedConfig: loadMergedConfigMock,
  loadMcpServerStatuses: loadMcpServerStatusesMock,
  loadAuthStatus: loadAuthStatusMock,
  mcpServersFromConfig: mcpServersFromConfigMock,
  providersFromConfig: providersFromConfigMock,
  validateConfig: validateConfigMock,
  startMcpServerOauthLogin: startMcpServerOauthLoginMock,
  reloadMcpServerConnections: reloadMcpServerConnectionsMock,
}));

vi.mock("@/app/services/cli/commands", () => ({
  execCommand: () =>
    Promise.resolve({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }),
}));

vi.mock("@/app/services/cli/threads", () => ({
  listThreads: () =>
    Promise.resolve({
      data: [],
      nextCursor: null,
    }),
  unarchiveThread: () => Promise.resolve({}),
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: () => false,
}));

describe("SettingsPage MCP OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMergedConfigMock.mockResolvedValue({});
    loadMcpServerStatusesMock.mockResolvedValue([
      {
        id: "github",
        status: "needs_auth",
        authStatus: "notLoggedIn",
      },
    ]);
    loadAuthStatusMock.mockResolvedValue({
      status: "unknown",
      requiresOpenaiAuth: null,
    });
    mcpServersFromConfigMock.mockReturnValue([
      {
        id: "github",
        name: "github",
        endpoint: "mcp://github",
        status: "needs_auth",
        authStatus: "notLoggedIn",
      },
    ]);
    providersFromConfigMock.mockReturnValue([]);
    validateConfigMock.mockResolvedValue({
      valid: true,
      errors: [],
      keys: 0,
    });
    startMcpServerOauthLoginMock.mockResolvedValue({
      name: "github",
      authorizationUrl: "https://example.test/mcp-oauth",
    });
    reloadMcpServerConnectionsMock.mockResolvedValue({});
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("starts OAuth login and refreshes status after completion notification", async () => {
    render(<SettingsPage />);

    const connectButton = await screen.findByRole("button", {
      name: "Connect",
    });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(startMcpServerOauthLoginMock).toHaveBeenCalledWith("github");
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://example.test/mcp-oauth",
      "_blank",
      "noopener,noreferrer",
    );

    registerAuthNotification({
      method: "mcpServer/oauthLogin/completed",
      params: {
        name: "github",
        success: true,
      },
    });

    await waitFor(() => {
      expect(reloadMcpServerConnectionsMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(loadMcpServerStatusesMock.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
