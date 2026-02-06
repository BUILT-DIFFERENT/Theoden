import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomBar } from "@/app/components/layout/BottomBar";
import { AppSidebar } from "@/app/components/sidebar/AppSidebar";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadTopBar } from "@/app/components/threads/ThreadTopBar";
import { useInteractionAudit } from "@/app/services/dev/useInteractionAudit";
import { AppUiProvider } from "@/app/state/appUi";
import { EnvironmentUiProvider } from "@/app/state/environmentUi";
import { ThreadUiProvider, type ThreadModal } from "@/app/state/threadUi";
import { WorkspaceUiProvider } from "@/app/state/workspaceUi";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onClick?.();
      }}
    >
      {children}
    </button>
  ),
  useMatchRoute: () => () => false,
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 120,
        size: 120,
      })),
    measure: () => {},
    measureElement: () => {},
  }),
}));

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [
      { path: "C:/repo/alpha", name: "alpha" },
      { path: "C:/repo/bravo", name: "bravo" },
    ],
    isLoading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}));

vi.mock("@/app/services/cli/useThreads", () => ({
  useThreadList: () => ({
    threads: [
      {
        id: "thread-alpha",
        title: "Alpha thread",
        subtitle: "C:/repo/alpha",
        status: "done",
        projectId: "alpha",
        lastUpdated: "1m",
      },
      {
        id: "thread-bravo",
        title: "Bravo thread",
        subtitle: "C:/repo/bravo",
        status: "done",
        projectId: "bravo",
        lastUpdated: "2m",
      },
    ],
    allThreads: [
      {
        id: "thread-alpha",
        title: "Alpha thread",
        subtitle: "C:/repo/alpha",
        status: "done",
        projectId: "alpha",
        lastUpdated: "1m",
      },
      {
        id: "thread-bravo",
        title: "Bravo thread",
        subtitle: "C:/repo/bravo",
        status: "done",
        projectId: "bravo",
        lastUpdated: "2m",
      },
    ],
    projects: [],
  }),
}));

vi.mock("@/app/services/cli/useAccount", () => ({
  useAccount: () => ({
    account: null,
  }),
}));

vi.mock("@/app/services/cli/account", () => ({
  logoutAccount: () => Promise.resolve(),
  startAccountLogin: () => Promise.resolve({}),
}));

vi.mock("@/app/services/git/useWorkspaceGitStatus", () => ({
  useWorkspaceGitStatus: () => ({
    status: {
      branch: "main",
      ahead: 0,
      behind: 0,
      stagedPaths: [],
      unstagedPaths: [],
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/app/services/git/useWorkspaceBranches", () => ({
  useWorkspaceBranches: () => ({
    branches: ["main", "feature/work"],
    isLoading: false,
  }),
}));

vi.mock("@/app/services/git/worktrees", () => ({
  checkoutBranch: () => Promise.resolve(),
}));

vi.mock("@/app/services/cli/useThreadDetail", () => ({
  useThreadDetail: () => ({
    thread: undefined,
    messages: [],
    isLoading: false,
  }),
}));

vi.mock("@/app/services/cli/useRunProgress", () => ({
  useRunProgress: () => ({
    percent: 0,
    isActive: false,
  }),
}));

vi.mock("@/app/services/cli/fileIndex", () => ({
  getWorkspaceFileIndex: () => Promise.resolve([]),
}));

vi.mock("@/app/services/cli/turns", () => ({
  startThread: () => Promise.resolve({ id: "thread-generated" }),
  resumeThread: () => Promise.resolve({}),
  startTurn: () => Promise.resolve({ id: "turn-generated", status: "running" }),
  cancelTurn: () => Promise.resolve({}),
}));

vi.mock("@/app/services/cli/useThreadDiff", () => ({
  useThreadDiffText: () => "",
}));

vi.mock("@/app/state/threadMetadata", () => ({
  useThreadMetadata: () => ({
    metadata: {},
  }),
}));

vi.mock("@/app/services/git/commits", () => ({
  getPrPrerequisiteStatus: () =>
    Promise.resolve({
      ready: true,
      reason: null,
      steps: [],
    }),
  pushBranch: () => Promise.resolve(),
  createPullRequest: () => Promise.resolve(),
}));

vi.mock("@/app/services/desktop/open", () => ({
  openInEditor: () => Promise.resolve(),
  openPathInTerminal: () => Promise.resolve(),
  openPathInExplorer: () => Promise.resolve(),
  openTargetOptions: () => [
    {
      id: "editor",
      label: "Open in VS Code",
      detail: "Use configured editor command",
    },
  ],
}));

vi.mock("@/app/state/useRuntimeSettings", () => ({
  useRuntimeSettings: () => ({
    openDestination: "vscode",
    followUpBehavior: "append",
    compactComposer: false,
    defaultBranch: "main",
    allowCommunitySkills: true,
    autoRefreshSkills: false,
    showExperimentalConfig: false,
  }),
}));

function ThreadUiHarness({ children }: { children: ReactNode }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ThreadModal>(null);
  const value = useMemo(
    () => ({
      reviewOpen,
      setReviewOpen,
      activeModal,
      setActiveModal,
    }),
    [activeModal, reviewOpen],
  );
  return <ThreadUiProvider value={value}>{children}</ThreadUiProvider>;
}

function renderWithProviders() {
  const queryClient = new QueryClient();

  function AuditMount() {
    useInteractionAudit();
    return null;
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AppUiProvider>
        <WorkspaceUiProvider>
          <EnvironmentUiProvider>
            <ThreadUiHarness>
              <div>
                <AuditMount />
                <AppSidebar />
                <ThreadTopBar
                  title="New thread"
                  isNewThread
                  isTerminalOpen={false}
                  onToggleTerminal={() => {}}
                />
                <ThreadComposer />
                <BottomBar />
              </div>
            </ThreadUiHarness>
          </EnvironmentUiProvider>
        </WorkspaceUiProvider>
      </AppUiProvider>
    </QueryClientProvider>,
  );
}

describe("workspace switching propagation", () => {
  it("updates top bar, composer, and bottom bar when sidebar workspace changes", async () => {
    renderWithProviders();

    const header = screen.getByRole("banner");
    expect(within(header).getByText("alpha")).toBeInTheDocument();

    const bravoWorkspaceButton = screen.getByRole("button", {
      name: /^bravo$/i,
    });
    fireEvent.click(bravoWorkspaceButton);

    await waitFor(() => {
      expect(within(header).getByText("bravo")).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /bravo/i }).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });
});

const smokeEnabled = import.meta.env.VITE_UI_SMOKE_TEST === "1";

(smokeEnabled ? describe : describe.skip)("workspace interaction smoke", () => {
  it("renders without dead actions in the shell controls", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-ui-audit-dead-action="true"]').length,
      ).toBe(0);
    });
  });
});
