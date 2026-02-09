import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseWorktreeListPorcelain,
  removeWorktree,
} from "@/app/services/git/worktrees";

const { execCommandMock } = vi.hoisted(() => ({
  execCommandMock: vi.fn(),
}));

vi.mock("@/app/services/cli/commands", () => ({
  execCommand: execCommandMock,
}));

describe("worktree helpers", () => {
  beforeEach(() => {
    execCommandMock.mockReset();
  });

  it("parses git worktree porcelain output with flags and linked thread ids", () => {
    const output = [
      "worktree C:/repo/theoden",
      "HEAD aaaaaaa",
      "branch refs/heads/main",
      "",
      "worktree C:/repo/theoden/.codex/worktrees/thread-123",
      "HEAD bbbbbbb",
      "detached",
      "prunable gitdir file points to non-existent location",
      "",
      "worktree C:/repo/theoden/workspaces/feature-x",
      "HEAD ccccccc",
      "branch refs/heads/feature/x",
      "",
      "worktree C:/repo/theoden/workspaces/bare",
      "HEAD ddddddd",
      "bare",
      "",
    ].join("\n");

    expect(parseWorktreeListPorcelain(output, "C:/repo/theoden")).toEqual([
      {
        path: "C:/repo/theoden",
        branch: "main",
        head: "aaaaaaa",
        isCurrent: true,
        isDetached: false,
        isBare: false,
        isPrunable: false,
        prunableReason: null,
        linkedThreadId: null,
      },
      {
        path: "C:/repo/theoden/.codex/worktrees/thread-123",
        branch: null,
        head: "bbbbbbb",
        isCurrent: false,
        isDetached: true,
        isBare: false,
        isPrunable: true,
        prunableReason: "gitdir file points to non-existent location",
        linkedThreadId: "thread-123",
      },
      {
        path: "C:/repo/theoden/workspaces/feature-x",
        branch: "feature/x",
        head: "ccccccc",
        isCurrent: false,
        isDetached: false,
        isBare: false,
        isPrunable: false,
        prunableReason: null,
        linkedThreadId: null,
      },
      {
        path: "C:/repo/theoden/workspaces/bare",
        branch: null,
        head: "ddddddd",
        isCurrent: false,
        isDetached: false,
        isBare: true,
        isPrunable: false,
        prunableReason: null,
        linkedThreadId: null,
      },
    ]);
  });

  it("blocks remove action for the main worktree path", async () => {
    await expect(
      removeWorktree("C:/repo/theoden", "C:/repo/theoden"),
    ).rejects.toThrow("Cannot remove the main workspace worktree.");
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  it("removes a non-main worktree with git worktree remove --force", async () => {
    execCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    await removeWorktree(
      "C:/repo/theoden",
      "C:/repo/theoden/.codex/worktrees/thread-123",
    );
    expect(execCommandMock).toHaveBeenCalledWith({
      command: [
        "git",
        "worktree",
        "remove",
        "--force",
        "C:/repo/theoden/.codex/worktrees/thread-123",
      ],
      cwd: "C:/repo/theoden",
    });
  });
});
