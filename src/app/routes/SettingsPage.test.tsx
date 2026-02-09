import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/app/routes/SettingsPage";

const { listThreadsMock, unarchiveThreadMock } = vi.hoisted(() => ({
  listThreadsMock: vi.fn(),
  unarchiveThreadMock: vi.fn(),
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
  useParams: () => ({ section: "archived-threads" }),
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
  loadAuthStatus: () =>
    Promise.resolve({
      status: "unknown",
      requiresOpenaiAuth: null,
    }),
  loadMergedConfig: () => Promise.resolve({}),
  loadMcpServerStatuses: () => Promise.resolve([]),
  mcpServersFromConfig: () => [],
  providersFromConfig: () => [],
  reloadMcpServerConnections: () => Promise.resolve({}),
  startMcpServerOauthLogin: () =>
    Promise.resolve({
      name: "github",
      authorizationUrl: "https://example.test/oauth",
    }),
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
  listThreads: listThreadsMock,
  unarchiveThread: unarchiveThreadMock,
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: () => false,
}));

describe("SettingsPage archived threads", () => {
  beforeEach(() => {
    listThreadsMock.mockReset();
    unarchiveThreadMock.mockReset();
    listThreadsMock.mockResolvedValue({
      data: [
        {
          id: "thread-1",
          preview: "Archived thread one",
          updatedAt: 1_738_900_000,
        },
      ],
      nextCursor: null,
    });
    unarchiveThreadMock.mockResolvedValue({});
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
      expect(unarchiveThreadMock).toHaveBeenCalledWith("thread-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Archived thread one")).not.toBeInTheDocument();
    });
  });
});
