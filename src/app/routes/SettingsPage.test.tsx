import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "@/app/routes/SettingsPage";

const {
  listThreadsMock,
  unarchiveThreadMock,
  loadAuthStatusMock,
  loadConfigSnapshotMock,
  loadMcpServerStatusesMock,
  mcpServersFromConfigMock,
  providersFromConfigMock,
  validateConfigMock,
  reloadMcpServerConfigMock,
  writeMcpServerConfigMock,
  mapConfigWriteErrorMessageMock,
} = vi.hoisted(() => ({
  listThreadsMock: vi.fn(),
  unarchiveThreadMock: vi.fn(),
  loadAuthStatusMock: vi.fn(),
  loadConfigSnapshotMock: vi.fn(),
  loadMcpServerStatusesMock: vi.fn(),
  mcpServersFromConfigMock: vi.fn(),
  providersFromConfigMock: vi.fn(),
  validateConfigMock: vi.fn(),
  reloadMcpServerConfigMock: vi.fn(),
  writeMcpServerConfigMock: vi.fn(),
  mapConfigWriteErrorMessageMock: vi.fn(),
}));

let mockSection = "archived-threads";

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
  useParams: () => ({ section: mockSection }),
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

vi.mock("@/app/services/cli/configWarnings", () => ({
  getConfigWarnings: () => [],
  subscribeConfigWarnings: () => () => {},
}));

vi.mock("@/app/services/cli/config", () => ({
  loadAuthStatus: loadAuthStatusMock,
  loadConfigSnapshot: loadConfigSnapshotMock,
  loadMcpServerStatuses: loadMcpServerStatusesMock,
  mcpServersFromConfig: mcpServersFromConfigMock,
  providersFromConfig: providersFromConfigMock,
  validateConfig: validateConfigMock,
  reloadMcpServerConfig: reloadMcpServerConfigMock,
  writeMcpServerConfig: writeMcpServerConfigMock,
  mapConfigWriteErrorMessage: mapConfigWriteErrorMessageMock,
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

describe("SettingsPage", () => {
  beforeEach(() => {
    mockSection = "archived-threads";
    listThreadsMock.mockReset();
    unarchiveThreadMock.mockReset();
    loadAuthStatusMock.mockReset();
    loadConfigSnapshotMock.mockReset();
    loadMcpServerStatusesMock.mockReset();
    mcpServersFromConfigMock.mockReset();
    providersFromConfigMock.mockReset();
    validateConfigMock.mockReset();
    reloadMcpServerConfigMock.mockReset();
    writeMcpServerConfigMock.mockReset();
    mapConfigWriteErrorMessageMock.mockReset();

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
    loadAuthStatusMock.mockResolvedValue({
      status: "unknown",
      requiresOpenaiAuth: null,
    });
    loadConfigSnapshotMock.mockResolvedValue({
      config: {
        model: "gpt-5-codex",
      },
      origins: {},
      layers: [],
      writeTarget: {
        filePath: "/home/user/.codex/config.toml",
        expectedVersion: "sha256:abc",
      },
    });
    loadMcpServerStatusesMock.mockResolvedValue([]);
    mcpServersFromConfigMock.mockReturnValue([]);
    providersFromConfigMock.mockReturnValue([]);
    validateConfigMock.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      keys: 1,
    });
    reloadMcpServerConfigMock.mockResolvedValue({});
    writeMcpServerConfigMock.mockResolvedValue({
      status: "ok",
      version: "sha256:new",
      filePath: "/home/user/.codex/config.toml",
      overriddenMetadata: null,
    });
    mapConfigWriteErrorMessageMock.mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : "error",
    );
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

  it("persists MCP add/update/delete through config writes", async () => {
    mockSection = "mcp-servers";
    loadConfigSnapshotMock.mockResolvedValue({
      config: {
        mcp_servers: {
          existing: {
            name: "Existing",
            transport: "stdio",
            command: "npx existing",
          },
        },
      },
      origins: {
        "mcp_servers.existing.command": {
          name: {
            type: "user",
            file: "/home/user/.codex/config.toml",
          },
          version: "sha256:existing",
        },
      },
      layers: [],
      writeTarget: {
        filePath: "/home/user/.codex/config.toml",
        expectedVersion: "sha256:existing",
      },
    });
    mcpServersFromConfigMock.mockReturnValue([
      {
        id: "existing",
        name: "Existing",
        endpoint: "npx existing",
        status: "connected",
      },
    ]);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(loadConfigSnapshotMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ New server" }));
    fireEvent.change(screen.getByPlaceholderText("github"), {
      target: { value: "github" },
    });
    fireEvent.change(screen.getByLabelText(/Command/i), {
      target: { value: "npx github-mcp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save server" }));

    await waitFor(() => {
      expect(writeMcpServerConfigMock).toHaveBeenCalledWith({
        serverId: "github",
        value: {
          disabled: false,
          transport: "stdio",
          command: "npx github-mcp",
        },
        cwd: "/repo/theoden",
      });
    });
    await waitFor(() => {
      expect(reloadMcpServerConfigMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    await waitFor(() => {
      expect(writeMcpServerConfigMock).toHaveBeenCalledWith({
        serverId: "existing",
        value: null,
        cwd: "/repo/theoden",
      });
    });
  });

  it("renders real config preview and validation output", async () => {
    mockSection = "configuration";
    loadConfigSnapshotMock.mockResolvedValue({
      config: {
        model: "gpt-5-codex",
        experimental_feature_flag: true,
      },
      origins: {
        model: {
          name: {
            type: "user",
            file: "/home/user/.codex/config.toml",
          },
          version: "sha256:user",
        },
      },
      layers: [
        {
          name: {
            type: "user",
            file: "/home/user/.codex/config.toml",
          },
          version: "sha256:user",
          config: {
            model: "gpt-5-codex",
          },
          disabledReason: null,
        },
      ],
      writeTarget: {
        filePath: "/home/user/.codex/config.toml",
        expectedVersion: "sha256:user",
      },
    });
    validateConfigMock.mockResolvedValue({
      valid: false,
      errors: ["Unknown key experimental_feature_flag"],
      warnings: [
        {
          summary: "Project config warning",
          details: "Check project settings",
          path: "/repo/theoden/.codex/config.toml",
        },
      ],
      keys: 2,
    });

    render(<SettingsPage />);

    expect(
      await screen.findByText(/"model": "gpt-5-codex"/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/experimental_feature_flag/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show experimental keys"));
    expect(
      await screen.findByText(/experimental_feature_flag/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Validate TOML" }));

    await waitFor(() => {
      expect(validateConfigMock).toHaveBeenCalledWith("/repo/theoden");
    });
    const validationErrors = await screen.findAllByText(
      "Unknown key experimental_feature_flag",
    );
    expect(validationErrors.length).toBeGreaterThan(0);
    expect(screen.getByText(/Project config warning/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Include project overrides/i));
    await waitFor(() => {
      expect(loadConfigSnapshotMock).toHaveBeenCalledWith(null);
    });
  });
});
