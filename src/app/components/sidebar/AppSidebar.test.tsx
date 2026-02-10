import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/app/components/sidebar/AppSidebar";

const { startAccountLoginMock, logoutAccountMock } = vi.hoisted(() => ({
  startAccountLoginMock: vi.fn(),
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
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AppSidebar />
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

describe("AppSidebar account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startAccountLoginMock.mockResolvedValue({
      type: "chatgpt",
      loginId: "login-123",
      authUrl: "https://example.test/login",
    });
    logoutAccountMock.mockResolvedValue({});
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(window, "prompt").mockReturnValue("sk-test");
  });

  it("starts ChatGPT sign-in in browser and defers account refresh", async () => {
    const { queryClient } = renderSidebar();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

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
    await waitFor(() => {
      expect(
        screen.getByText("Complete sign-in in your browser."),
      ).toBeInTheDocument();
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it("defers refresh when API-key sign-in falls back to ChatGPT OAuth", async () => {
    const { queryClient } = renderSidebar();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    startAccountLoginMock.mockResolvedValueOnce({
      type: "chatgpt",
      loginId: "login-456",
      authUrl: "https://example.test/oauth",
    });

    fireEvent.click(screen.getByRole("button", { name: /not signed in/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with API key" }),
    );

    await waitFor(() => {
      expect(startAccountLoginMock).toHaveBeenCalledWith("apiKey", "sk-test");
    });
    await waitFor(() => {
      expect(
        screen.getByText("Complete sign-in in your browser."),
      ).toBeInTheDocument();
    });
    expect(window.open).toHaveBeenCalledWith(
      "https://example.test/oauth",
      "_blank",
      "noopener,noreferrer",
    );
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
