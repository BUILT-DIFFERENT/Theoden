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
  loadAuthStatus: () =>
    Promise.resolve({
      status: "unknown",
      requiresOpenaiAuth: null,
    }),
  loadMergedConfig: () => Promise.resolve({}),
  loadMcpServerStatuses: () => Promise.resolve([]),
  mcpServersFromConfig: () => [],
  providersFromConfig: () => [],
  validateConfig: () => Promise.resolve({ valid: true, errors: [], keys: 0 }),
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads archived threads and restores an individual thread", async () => {
    render(<SettingsPage />);

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
    render(<SettingsPage />);
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

    render(<SettingsPage />);

    expect(await screen.findByText("Used: 41%")).toBeInTheDocument();

    mocks.notificationListeners.forEach((listener) =>
      listener({ method: "account/rateLimits/updated" }),
    );

    await waitFor(() => {
      expect(mocks.readAccountRateLimitsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Used: 52%")).toBeInTheDocument();
  });
});
