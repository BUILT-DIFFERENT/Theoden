import {
  execCommand,
  type CommandExecResult,
} from "@/app/services/cli/commands";
import type { WorkspaceStrategy } from "@/app/types";

export interface WorkspaceCreateRequest {
  repoPath: string;
  threadId: string;
  baseBranch: string;
  strategy: WorkspaceStrategy;
  targetPath?: string;
}

export interface WorkspaceInfo {
  id: string;
  path: string;
  branch: string;
  strategy: WorkspaceStrategy;
}

export interface WorkspaceCreateResult {
  info: WorkspaceInfo;
  logs: string[];
}

const NEWLINE_REGEX = /\r?\n/;

function appendCommandOutput(
  logs: string[],
  result: CommandExecResult,
  label: string,
) {
  logs.push(label);
  if (result.stdout.trim().length) {
    result.stdout
      .split(NEWLINE_REGEX)
      .filter(Boolean)
      .forEach((line) => logs.push(line));
  }
  if (result.stderr.trim().length) {
    result.stderr
      .split(NEWLINE_REGEX)
      .filter(Boolean)
      .forEach((line) => logs.push(`stderr: ${line}`));
  }
  logs.push(`exit ${result.exitCode}`);
}

function ensureSuccess(result: CommandExecResult, action: string) {
  if (result.exitCode === 0) return;
  const message = result.stderr.trim() || result.stdout.trim();
  throw new Error(`${action} failed${message ? `: ${message}` : ""}`);
}

async function runGit(args: string[], cwd: string) {
  return execCommand({ command: ["git", ...args], cwd });
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

export async function createWorkspace(
  request: WorkspaceCreateRequest,
): Promise<WorkspaceCreateResult> {
  const logs: string[] = [];
  const repoRootResult = await runGit(
    ["rev-parse", "--show-toplevel"],
    request.repoPath,
  );
  appendCommandOutput(logs, repoRootResult, "Resolving repo root");
  ensureSuccess(repoRootResult, "Resolve repo root");
  const repoRoot = repoRootResult.stdout.trim();
  if (!repoRoot) {
    throw new Error("Unable to resolve repo root.");
  }

  const baseBranch = request.baseBranch || "main";
  const normalizedRoot = normalizePath(repoRoot);
  const targetPath =
    request.targetPath ??
    `${normalizedRoot}/.codex/worktrees/${request.threadId}`;

  if (request.strategy === "clone") {
    const cloneResult = await runGit(
      ["clone", "--no-checkout", normalizedRoot, targetPath],
      request.repoPath,
    );
    appendCommandOutput(logs, cloneResult, "Cloning workspace");
    ensureSuccess(cloneResult, "Clone workspace");
    const checkoutResult = await runGit(
      ["-C", targetPath, "checkout", "--detach", baseBranch],
      request.repoPath,
    );
    appendCommandOutput(logs, checkoutResult, "Checking out base branch");
    ensureSuccess(checkoutResult, "Checkout base branch");
  } else {
    const worktreeResult = await runGit(
      ["worktree", "add", "--detach", targetPath, baseBranch],
      request.repoPath,
    );
    appendCommandOutput(logs, worktreeResult, "Creating git worktree");
    ensureSuccess(worktreeResult, "Create git worktree");
  }

  const info: WorkspaceInfo = {
    id: `ws-${Date.now()}`,
    path: targetPath,
    branch: baseBranch,
    strategy: request.strategy,
  };

  logs.push(`Worktree created at ${targetPath}`);

  return { info, logs };
}

export async function createBranch(workspacePath: string, branchName: string) {
  const result = await runGit(["checkout", "-b", branchName], workspacePath);
  ensureSuccess(result, "Create branch");
  return result;
}

export async function checkoutBranch(repoPath: string, branchName: string) {
  const result = await runGit(["checkout", branchName], repoPath);
  ensureSuccess(result, "Checkout branch");
  return result;
}

export async function mergeWorkspace(
  workspaceId: string,
  targetBranch: string,
  strategy: "rebase" | "merge" | "squash",
): Promise<void> {
  void workspaceId;
  void targetBranch;
  void strategy;
  return Promise.resolve();
}
