import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  revertAllPaths,
  revertHunk,
  revertPath,
  stageHunk,
  stagePath,
  unstageHunk,
  unstagePath,
} from "@/app/services/git/changes";

const { execCommandMock, invokeMock } = vi.hoisted(() => ({
  execCommandMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@/app/services/cli/commands", () => ({
  execCommand: execCommandMock,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("git changes service", () => {
  const cwd = "C:/repo/theoden";

  beforeEach(() => {
    execCommandMock.mockReset();
    invokeMock.mockReset();
  });

  it("stages a path via git add", async () => {
    execCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    await stagePath(cwd, "src/main.ts");
    expect(execCommandMock).toHaveBeenCalledWith({
      command: ["git", "add", "--", "src/main.ts"],
      cwd,
    });
  });

  it("unstages path with git restore when supported", async () => {
    execCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    await unstagePath(cwd, "src/main.ts");
    expect(execCommandMock).toHaveBeenCalledTimes(1);
    expect(execCommandMock).toHaveBeenCalledWith({
      command: ["git", "restore", "--staged", "--", "src/main.ts"],
      cwd,
    });
  });

  it("falls back to git reset when git restore --staged fails", async () => {
    execCommandMock
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "unknown option",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      });

    await unstagePath(cwd, "src/main.ts");

    expect(execCommandMock).toHaveBeenNthCalledWith(1, {
      command: ["git", "restore", "--staged", "--", "src/main.ts"],
      cwd,
    });
    expect(execCommandMock).toHaveBeenNthCalledWith(2, {
      command: ["git", "reset", "HEAD", "--", "src/main.ts"],
      cwd,
    });
  });

  it("stages and unstages a hunk via host git_apply_patch", async () => {
    invokeMock.mockResolvedValue({
      code: 0,
      stdout: "",
      stderr: "",
    });

    await stageHunk(cwd, "patch-1");
    await unstageHunk(cwd, "patch-2");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "git_apply_patch", {
      cwd,
      patch: "patch-1",
      cached: true,
      reverse: false,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "git_apply_patch", {
      cwd,
      patch: "patch-2",
      cached: true,
      reverse: true,
    });
  });

  it("reverts path with staged and unstaged variants", async () => {
    execCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    await revertPath(cwd, "src/main.ts", false);
    await revertPath(cwd, "src/main.ts", true);

    expect(execCommandMock).toHaveBeenNthCalledWith(1, {
      command: ["git", "restore", "--worktree", "--", "src/main.ts"],
      cwd,
    });
    expect(execCommandMock).toHaveBeenNthCalledWith(2, {
      command: [
        "git",
        "restore",
        "--source=HEAD",
        "--staged",
        "--worktree",
        "--",
        "src/main.ts",
      ],
      cwd,
    });
  });

  it("reverts all paths with staged and unstaged variants", async () => {
    execCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    await revertAllPaths(cwd, false);
    await revertAllPaths(cwd, true);

    expect(execCommandMock).toHaveBeenNthCalledWith(1, {
      command: ["git", "restore", "--worktree", "--", "."],
      cwd,
    });
    expect(execCommandMock).toHaveBeenNthCalledWith(2, {
      command: [
        "git",
        "restore",
        "--source=HEAD",
        "--staged",
        "--worktree",
        "--",
        ".",
      ],
      cwd,
    });
  });

  it("tolerates 'does not apply' during staged hunk revert", async () => {
    invokeMock
      .mockResolvedValueOnce({
        code: 0,
        stdout: "",
        stderr: "",
      })
      .mockRejectedValueOnce(new Error("Patch does not apply"));

    await expect(revertHunk(cwd, "patch", true)).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "git_apply_patch", {
      cwd,
      patch: "patch",
      cached: true,
      reverse: true,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "git_apply_patch", {
      cwd,
      patch: "patch",
      cached: false,
      reverse: true,
    });
  });

  it("fails revert hunk when non-apply error occurs", async () => {
    invokeMock
      .mockResolvedValueOnce({
        code: 0,
        stdout: "",
        stderr: "",
      })
      .mockRejectedValueOnce(new Error("permission denied"));

    await expect(revertHunk(cwd, "patch", true)).rejects.toThrow(
      "permission denied",
    );
  });
});
