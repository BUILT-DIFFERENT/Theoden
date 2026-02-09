import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/app/components/sidebar/AppSidebar";
import { registerAuthNotification } from "@/app/services/cli/authNotifications";

const { startAccountLoginMock, cancelAccountLoginMock, logoutAccountMock } =
  vi.hoisted(() => ({
    startAccountLoginMock: vi.fn(),
    cancelAccountLoginMock: vi.fn(),
    logoutAccountMock: vi.fn(),
  }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    onClick,
  }: {
    children: unknown;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children as string}
    </button>
  ),
  useMatchRoute: () => () => false,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    measure: vi.fn(),
    measureElement: vi.fn(),
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  }),
}));

vi.mock("@/app/services/cli/account", () => ({
  startAccountLogin: startAccountLoginMock,
  cancelAccountLogin: cancelAccountLoginMock,
  logoutAccount: logoutAccountMock,
}));

vi.mock("@/app/services/cli/useAccount", () => ({
  useAccount: () => ({
    account: {
      isAuthenticated: false,
      email: null,
      organizationName: null,
      authMethod: null,
    },
  }),
}));

vi.mock("@/app/services/cli/useThreads", () => ({
  useThreadList: () => ({
    projects: [],
    allThreads: [],
  }),
}));

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [],
  }),
}));

vi.mock("@/app/state/appUi", () => ({
  useAppUi: () => ({
    setComposerDraft: vi.fn(),
  }),
}));

vi.mock("@/app/state/threadUi", () => ({
  useThreadUi: () => ({
    setActiveModal: vi.fn(),
    setReviewOpen: vi.fn(),
  }),
}));

vi.mock("@/app/state/workspaceUi", () => ({
  useWorkspaceUi: () => ({
    selectedWorkspace: null,
    setSelectedWorkspace: vi.fn(),
    setWorkspacePickerOpen: vi.fn(),
  }),
}));

vi.mock("@/app/state/sidebarUi", () => ({
  loadStoredSidebarUi: () => ({
    threadSort: "updated",
    threadVisibility: "all",
    expandedWorkspaceKeys: [],
    scrollTop: 0,
  }),
  storeSidebarUi: vi.fn(),
}));

function renderSidebar() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AppSidebar />
    </QueryClientProvider>,
  );
}

describe("AppSidebar account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startAccountLoginMock.mockResolvedValue({
      type: "chatgpt",
      loginId: "login-123",
      authUrl: "https://example.test/login",
    });
    cancelAccountLoginMock.mockResolvedValue("canceled");
    logoutAccountMock.mockResolvedValue({});
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("tracks pending chatgpt login and resolves on completion notification", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /not signed in/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with ChatGPT" }),
    );

    await waitFor(() => {
      expect(startAccountLoginMock).toHaveBeenCalledWith("chatgpt");
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://example.test/login",
      "_blank",
      "noopener,noreferrer",
    );

    expect(
      screen.getByRole("button", { name: "Awaiting browser confirmation…" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel ChatGPT sign in" }),
    ).toBeInTheDocument();

    registerAuthNotification({
      method: "account/login/completed",
      params: {
        loginId: "login-123",
        success: true,
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign in with ChatGPT" }),
      ).toBeInTheDocument();
    });
  });

  it("cancels a pending chatgpt login", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /not signed in/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with ChatGPT" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel ChatGPT sign in" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel ChatGPT sign in" }),
    );

    await waitFor(() => {
      expect(cancelAccountLoginMock).toHaveBeenCalledWith("login-123");
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign in with ChatGPT" }),
      ).toBeInTheDocument();
    });
  });
});
