import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/app/routes/SettingsPage";

const mocks = vi.hoisted(() => {
  const notificationListeners: Array<
    (notification: { method: string }) => void
  > = [];
  return {
    currentSection: "archived-threads",
    isTauriEnabled: false,
    navigateMock: vi.fn(),
    listThreadsMock: vi.fn(),
    unarchiveThreadMock: vi.fn(),
    refreshAccountMock: vi.fn(),
    readAccountRateLimitsMock: vi.fn(),
    listWorktreesMock: vi.fn(),
    removeWorktreeMock: vi.fn(),
    writeConfigValueMock: vi.fn(),
    loadConfigSnapshotMock: vi.fn(),
    loadMergedConfigMock: vi.fn(),
    loadMcpServerStatusesMock: vi.fn(),
    loadAuthStatusMock: vi.fn(),
    readConfigRequirementsMock: vi.fn(),
    mcpServersFromConfigMock: vi.fn(),
    providersFromConfigMock: vi.fn(),
    reloadMcpServerConfigMock: vi.fn(),
    startMcpServerOauthLoginMock: vi.fn(),
    validateConfigMock: vi.fn(),
    mapConfigWriteErrorMessageMock: vi.fn(),
    notificationListeners,
    subscribeNotificationsMock: vi.fn(
      (listener: (notification: { method: string }) => void) => {
        notificationListeners.push(listener);
        return () => {
          const index = notificationListeners.indexOf(listener);
          if (index >= 0) {
            notificationListeners.splice(index, 1);
          }
        };
      },
    ),
  };
});

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
  useNavigate: () => mocks.navigateMock,
  useParams: () => ({ section: mocks.currentSection }),
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

vi.mock("@/app/services/cli/useAccount", () => ({
  useAccount: () => ({
    account: {
      isAuthenticated: true,
      email: "test@example.com",
      organizationName: "Test org",
      authMethod: "chatgpt",
    },
    isLoading: false,
    error: null,
    refresh: mocks.refreshAccountMock,
  }),
}));

vi.mock("@/app/services/cli/accountActions", () => ({
  AccountActionCancelledError: class AccountActionCancelledError extends Error {},
  runAccountAction: () => Promise.resolve("ok"),
}));

vi.mock("@/app/services/cli/accountUsage", () => ({
  readAccountRateLimits: mocks.readAccountRateLimitsMock,
}));

vi.mock("@/app/services/cli/appServerEventHub", () => ({
  subscribeAppServerNotifications: mocks.subscribeNotificationsMock,
}));

vi.mock("@/app/services/cli/config", () => ({
  loadAuthStatus: mocks.loadAuthStatusMock,
  loadConfigSnapshot: mocks.loadConfigSnapshotMock,
  loadMergedConfig: mocks.loadMergedConfigMock,
  loadMcpServerStatuses: mocks.loadMcpServerStatusesMock,
  mapConfigWriteErrorMessage: mocks.mapConfigWriteErrorMessageMock,
  mcpServersFromConfig: mocks.mcpServersFromConfigMock,
  providersFromConfig: mocks.providersFromConfigMock,
  readConfigRequirements: mocks.readConfigRequirementsMock,
  reloadMcpServerConfig: mocks.reloadMcpServerConfigMock,
  startMcpServerOauthLogin: mocks.startMcpServerOauthLoginMock,
  validateConfig: mocks.validateConfigMock,
  writeConfigValue: mocks.writeConfigValueMock,
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
  listThreads: mocks.listThreadsMock,
  unarchiveThread: mocks.unarchiveThreadMock,
}));

vi.mock("@/app/services/desktop/open", () => ({
  openPathInExplorer: () => Promise.resolve(),
}));

vi.mock("@/app/services/git/worktrees", () => ({
  listWorktrees: mocks.listWorktreesMock,
  removeWorktree: mocks.removeWorktreeMock,
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: () => mocks.isTauriEnabled,
}));

function renderSettingsPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe("SettingsPage archived threads", () => {
  beforeEach(() => {
    mocks.currentSection = "archived-threads";
    mocks.isTauriEnabled = false;
    mocks.notificationListeners.splice(0, mocks.notificationListeners.length);
    mocks.navigateMock.mockReset();
    mocks.listThreadsMock.mockReset();
    mocks.unarchiveThreadMock.mockReset();
    mocks.refreshAccountMock.mockReset();
    mocks.readAccountRateLimitsMock.mockReset();
    mocks.subscribeNotificationsMock.mockClear();
    mocks.listWorktreesMock.mockReset();
    mocks.removeWorktreeMock.mockReset();
    mocks.writeConfigValueMock.mockReset();
    mocks.loadConfigSnapshotMock.mockReset();
    mocks.loadMergedConfigMock.mockReset();
    mocks.loadMcpServerStatusesMock.mockReset();
    mocks.loadAuthStatusMock.mockReset();
    mocks.readConfigRequirementsMock.mockReset();
    mocks.mcpServersFromConfigMock.mockReset();
    mocks.providersFromConfigMock.mockReset();
    mocks.reloadMcpServerConfigMock.mockReset();
    mocks.startMcpServerOauthLoginMock.mockReset();
    mocks.validateConfigMock.mockReset();
    mocks.mapConfigWriteErrorMessageMock.mockReset();

    mocks.listThreadsMock.mockResolvedValue({
      data: [
        {
          id: "thread-1",
          preview: "Archived thread one",
          updatedAt: 1_738_900_000,
        },
      ],
      nextCursor: null,
    });
    mocks.unarchiveThreadMock.mockResolvedValue({});
    mocks.readAccountRateLimitsMock.mockResolvedValue({
      primary: null,
      secondary: null,
      credits: null,
      planType: null,
    });
    mocks.listWorktreesMock.mockResolvedValue([]);
    mocks.removeWorktreeMock.mockResolvedValue({});
    mocks.writeConfigValueMock.mockResolvedValue({
      status: "ok",
      version: "next",
      filePath: "C:/Users/gamer/.codex/config.toml",
      overriddenMetadata: null,
    });
    mocks.loadConfigSnapshotMock.mockResolvedValue({
      config: {},
      origins: {},
      layers: [],
      writeTarget: {
        filePath: "C:/Users/gamer/.codex/config.toml",
        expectedVersion: "sha256:1",
      },
    });
    mocks.loadMergedConfigMock.mockResolvedValue({});
    mocks.loadMcpServerStatusesMock.mockResolvedValue([]);
    mocks.loadAuthStatusMock.mockResolvedValue({
      status: "unknown",
      requiresOpenaiAuth: null,
    });
    mocks.readConfigRequirementsMock.mockResolvedValue(null);
    mocks.mcpServersFromConfigMock.mockReturnValue([]);
    mocks.providersFromConfigMock.mockReturnValue([]);
    mocks.reloadMcpServerConfigMock.mockResolvedValue({});
    mocks.startMcpServerOauthLoginMock.mockResolvedValue({
      name: "github",
      authorizationUrl: "https://example.test/oauth",
    });
    mocks.validateConfigMock.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      keys: [],
    });
    mocks.mapConfigWriteErrorMessageMock.mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : "config write failed",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads archived threads and restores an individual thread", async () => {
    renderSettingsPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Open archived threads" }),
    );

    expect(await screen.findByText("Archived thread one")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(mocks.unarchiveThreadMock).toHaveBeenCalledWith("thread-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Archived thread one")).not.toBeInTheDocument();
    });
  });

  it("includes parity settings sections in navigation", () => {
    mocks.currentSection = "general";
    renderSettingsPage();
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Data controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Usage & analytics" }),
    ).toBeInTheDocument();
  });

  it("refreshes usage analytics when rate-limit update notification arrives", async () => {
    mocks.currentSection = "usage-analytics";
    mocks.isTauriEnabled = true;
    mocks.readAccountRateLimitsMock
      .mockResolvedValueOnce({
        primary: {
          usedPercent: 41,
          windowDurationMins: 180,
          resetsAt: 1_738_900_000,
        },
        secondary: null,
        credits: null,
        planType: "pro",
      })
      .mockResolvedValueOnce({
        primary: {
          usedPercent: 52,
          windowDurationMins: 180,
          resetsAt: 1_738_900_600,
        },
        secondary: null,
        credits: null,
        planType: "pro",
      });

    renderSettingsPage();

    expect(await screen.findByText("Used: 41%")).toBeInTheDocument();

    mocks.notificationListeners.forEach((listener) =>
      listener({ method: "account/rateLimits/updated" }),
    );

    await waitFor(() => {
      expect(mocks.readAccountRateLimitsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Used: 52%")).toBeInTheDocument();
  });

  it("persists added MCP server settings through config writes", async () => {
    mocks.currentSection = "mcp-servers";
    renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Add MCP server" }));
    fireEvent.change(screen.getByPlaceholderText("github"), {
      target: { value: "github" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://example.mcp.local"), {
      target: { value: "https://mcp.example.local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save MCP server" }));

    await waitFor(() => {
      expect(mocks.writeConfigValueMock).toHaveBeenCalled();
    });
    expect(mocks.reloadMcpServerConfigMock).toHaveBeenCalled();
    expect(mocks.writeConfigValueMock.mock.calls[0]?.[0]).toMatchObject({
      keyPath: "mcp_servers",
      mergeStrategy: "replace",
    });
  });
});
