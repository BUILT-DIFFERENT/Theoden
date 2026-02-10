import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewThreadPage } from "@/app/routes/NewThreadPage";
import { ThreadPage } from "@/app/routes/ThreadPage";
import type { ThreadMessage } from "@/app/types";

import type { ReactNode } from "react";

interface MockThreadDetailResponse {
  thread:
    | {
        id: string;
        title: string;
        subtitle?: string;
        [key: string]: unknown;
      }
    | undefined;
  messages: ThreadMessage[];
  isLoading: boolean;
}

const mocks = vi.hoisted(() => {
  const setComposerDraftMock = vi.fn();
  const setActiveModalMock = vi.fn();
  const setSelectedWorkspaceMock = vi.fn();
  const useParamsMock = vi.fn(() => ({ threadId: "thread-1" }));
  const useThreadDetailMock =
    vi.fn<(threadId: string | undefined) => MockThreadDetailResponse>();

  const baseMessages: ThreadMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      content: "Initial response",
    },
  ];

  useThreadDetailMock.mockReturnValue({
    thread: {
      id: "thread-1",
      title: "Thread one",
      subtitle: "/repo/new",
      status: "done",
      projectId: "/repo/new",
      lastUpdated: "1m",
      mode: "local",
      effort: "high",
      events: [],
      attachments: [],
      diffSummary: { files: [], additions: 0, deletions: 0, totalFiles: 0 },
      diffText: "",
    },
    messages: baseMessages,
    isLoading: false,
  });

  return {
    baseMessages,
    setComposerDraftMock,
    setActiveModalMock,
    setSelectedWorkspaceMock,
    useParamsMock,
    useThreadDetailMock,
  };
});

vi.mock("@tanstack/react-router", () => ({
  useParams: () => mocks.useParamsMock(),
}));

vi.mock("@/app/components/threads/ApprovalsPanel", () => ({
  ApprovalsPanel: ({ threadId }: { threadId: string }) => (
    <div data-testid="approvals-panel">{threadId}</div>
  ),
}));

vi.mock("@/app/components/threads/ThreadComposer", () => ({
  ThreadComposer: ({
    onSubmitted,
    placeholder,
  }: {
    onSubmitted?: (message: string) => void;
    placeholder?: string;
  }) => (
    <div>
      <button type="button" onClick={() => onSubmitted?.("follow-up request")}>
        Submit follow-up
      </button>
      <span>{placeholder ?? "default-placeholder"}</span>
    </div>
  ),
}));

vi.mock("@/app/components/threads/ThreadMessages", () => ({
  ThreadMessages: ({ messages }: { messages: ThreadMessage[] }) => (
    <div>
      <div data-testid="message-count">{messages.length}</div>
      {messages.map((message) => (
        <div key={message.id}>{message.content}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/app/components/threads/ThreadModals", () => ({
  ThreadModals: () => <div data-testid="thread-modals">modals</div>,
}));

vi.mock("@/app/components/workspaces/WorkspacePickerDropdown", () => ({
  WorkspacePickerDropdown: ({
    trigger,
  }: {
    trigger: (input: { toggle: () => void }) => ReactNode;
  }) => (
    <div>
      {trigger({
        toggle: () => {},
      })}
    </div>
  ),
}));

vi.mock("@/app/services/cli/useThreadDetail", () => ({
  useThreadDetail: (threadId: string | undefined) =>
    mocks.useThreadDetailMock(threadId),
}));

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [{ path: "/repo/new", name: "Theoden" }],
  }),
}));

vi.mock("@/app/state/appUi", () => ({
  useAppUi: () => ({
    setComposerDraft: mocks.setComposerDraftMock,
  }),
}));

vi.mock("@/app/state/threadUi", () => ({
  useThreadUi: () => ({
    setActiveModal: mocks.setActiveModalMock,
  }),
}));

vi.mock("@/app/state/workspaceUi", () => ({
  useWorkspaceUi: () => ({
    selectedWorkspace: "/repo/old",
    setSelectedWorkspace: mocks.setSelectedWorkspaceMock,
  }),
}));

vi.mock("@/app/utils/workspace", () => ({
  isLikelyWorkspacePath: (value: string) => value.startsWith("/"),
  normalizeWorkspacePath: (value: string) =>
    value.replaceAll("\\", "/").toLowerCase(),
  workspaceNameFromPath: (value: string) => value.split("/").at(-1) ?? value,
}));

describe("Thread route slice parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useParamsMock.mockReturnValue({ threadId: "thread-1" });
    mocks.useThreadDetailMock.mockReturnValue({
      thread: {
        id: "thread-1",
        title: "Thread one",
        subtitle: "/repo/new",
      },
      messages: mocks.baseMessages,
      isLoading: false,
    });
  });

  it("resets draft and modal state on new thread route mount", () => {
    render(<NewThreadPage />);
    expect(mocks.setComposerDraftMock).toHaveBeenCalledWith("");
    expect(mocks.setActiveModalMock).toHaveBeenCalledWith(null);
  });

  it("syncs workspace from thread subtitle when viewing a thread", () => {
    render(<ThreadPage />);
    expect(mocks.setSelectedWorkspaceMock).toHaveBeenCalledWith("/repo/new");
    expect(screen.getByTestId("approvals-panel")).toHaveTextContent("thread-1");
  });

  it("shows optimistic message immediately after composer submission", () => {
    render(<ThreadPage />);
    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Submit follow-up" }));
    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    expect(screen.getByText("follow-up request")).toBeInTheDocument();
  });
});
