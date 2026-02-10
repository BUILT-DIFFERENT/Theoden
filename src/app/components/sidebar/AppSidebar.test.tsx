import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/app/components/sidebar/AppSidebar";

import type { ReactNode } from "react";

const mocks = vi.hoisted(() => {
  const navigateMock = vi.fn();
  const togglePinnedMock = vi.fn();
  const setAliasMock = vi.fn();
  const archiveThreadMock = vi.fn().mockResolvedValue({});
  const unarchiveThreadMock = vi.fn().mockResolvedValue({});
  const setReviewOpenMock = vi.fn();
  const setActiveModalMock = vi.fn();
  const setSelectedWorkspaceMock = vi.fn();
  const threads = Array.from({ length: 12 }, (_, index) => ({
    id: `thread-${index + 1}`,
    title: `Thread ${index + 1}`,
    subtitle: "/repo/theoden",
    status: "done" as const,
    projectId: "theoden",
    lastUpdated: "now",
    changeSummary: {
      additions: index + 1,
      deletions: index,
    },
  }));
  return {
    navigateMock,
    togglePinnedMock,
    setAliasMock,
    archiveThreadMock,
    unarchiveThreadMock,
    setReviewOpenMock,
    setActiveModalMock,
    setSelectedWorkspaceMock,
    threads,
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  useMatchRoute:
    () =>
    ({ to }: { to: string }) => {
      if (to === "/") {
        return {};
      }
      return false;
    },
  useNavigate: () => mocks.navigateMock,
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    measure: vi.fn(),
    measureElement: vi.fn(),
    getTotalSize: () => count * 96,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 96,
        key: index,
      })),
  }),
}));

vi.mock("@/app/services/cli/accountActions", () => ({
  AccountActionCancelledError: class AccountActionCancelledError extends Error {},
  runAccountAction: vi.fn().mockResolvedValue("ok"),
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
    projects: [{ id: "p1", name: "Theoden", path: "/repo/theoden" }],
    allThreads: mocks.threads,
  }),
}));

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [{ path: "/repo/theoden", name: "Theoden" }],
  }),
}));

vi.mock("@/app/services/cli/threads", () => ({
  archiveThread: mocks.archiveThreadMock,
  unarchiveThread: mocks.unarchiveThreadMock,
}));

vi.mock("@/app/services/host/automations", () => ({
  listInboxItems: vi.fn().mockResolvedValue([]),
  subscribeAutomationStoreUpdates: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@/app/state/appUi", () => ({
  useAppUi: () => ({
    setComposerDraft: vi.fn(),
  }),
}));

vi.mock("@/app/state/threadUi", () => ({
  useThreadUi: () => ({
    setActiveModal: mocks.setActiveModalMock,
    setReviewOpen: mocks.setReviewOpenMock,
  }),
}));

vi.mock("@/app/state/workspaceUi", () => ({
  useWorkspaceUi: () => ({
    selectedWorkspace: "/repo/theoden",
    setSelectedWorkspace: mocks.setSelectedWorkspaceMock,
    setWorkspacePickerOpen: vi.fn(),
  }),
}));

vi.mock("@/app/state/sidebarThreadMetadata", () => ({
  useSidebarThreadMetadataMap: () => ({
    "thread-1": { pinned: true, alias: "Pinned alias" },
  }),
  toggleSidebarThreadPinned: mocks.togglePinnedMock,
  setSidebarThreadAlias: mocks.setAliasMock,
}));

vi.mock("@/app/state/sidebarUi", () => ({
  loadStoredSidebarUi: () => ({
    threadSort: "updated",
    threadVisibility: "all",
    groupMode: "workspace",
    expandedWorkspaceKeys: ["/repo/theoden".toLowerCase()],
    scrollTop: 0,
  }),
  storeSidebarUi: vi.fn(),
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: () => false,
}));

function renderSidebar() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AppSidebar />
    </QueryClientProvider>,
  );
}

describe("AppSidebar parity actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "prompt").mockReturnValue("Renamed thread");
  });

  it("renders full thread list without truncating to 10", () => {
    renderSidebar();
    expect(screen.getByText("Thread 12")).toBeInTheDocument();
  });

  it("shows pinned alias and supports pin/rename/archive/open-changes actions", async () => {
    renderSidebar();

    expect(screen.getByText("Pinned alias")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Thread actions" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
    expect(mocks.togglePinnedMock).toHaveBeenCalledWith("thread-1");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Thread actions" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(mocks.setAliasMock).toHaveBeenCalledWith(
      "thread-1",
      "Renamed thread",
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Thread actions" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mocks.archiveThreadMock).toHaveBeenCalledWith("thread-1");
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Thread actions" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Open changes" }));
    expect(mocks.setReviewOpenMock).toHaveBeenCalledWith(true);
    expect(mocks.navigateMock).toHaveBeenCalled();
  });

  it("allows switching to recency grouping from filter menu", () => {
    renderSidebar();
    fireEvent.click(
      screen.getByRole("button", { name: "Thread sort and filter" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Group by recency" }));
    expect(screen.getByText("Recent threads")).toBeInTheDocument();
  });
});
