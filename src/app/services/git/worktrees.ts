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

export interface WorktreeInventoryRow {
  path: string;
  branch: string | null;
  head: string | null;
  isCurrent: boolean;
  isDetached: boolean;
  isBare: boolean;
  isPrunable: boolean;
  prunableReason: string | null;
  linkedThreadId: string | null;
}

export interface WorkspaceCreateResult {
  info: WorkspaceInfo;
  logs: string[];
}

export interface MergeWorkspaceRequest {
  repoPath: string;
  workspacePath: string;
  targetBranch: string;
  strategy: "rebase" | "merge" | "squash";
  removeWorktree: boolean;
}

export interface MergeWorkspaceResult {
  sourceBranch: string;
  targetBranch: string;
  logs: string[];
}

export class WorkspaceCreationCancelledError extends Error {
  constructor(message = "Worktree creation cancelled.") {
    super(message);
    this.name = "WorkspaceCreationCancelledError";
  }
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
  if (result.exitCode === 0) {
    return;
  }
  const message = result.stderr.trim() || result.stdout.trim();
  throw new Error(`${action} failed${message ? `: ${message}` : ""}`);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function trimTrailingSlash(path: string) {
  return normalizePath(path).replace(/\/+$/, "");
}

function linkedThreadIdFromWorktreePath(path: string) {
  const normalized = trimTrailingSlash(path);
  const match = normalized.match(/\/\.codex\/worktrees\/([^/]+)(?:$|\/)/i);
  return match?.[1] ?? null;
}

function branchFromRef(ref: string) {
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
}

export function parseWorktreeListPorcelain(output: string, repoPath: string) {
  const lines = output.split(NEWLINE_REGEX);
  const rows: WorktreeInventoryRow[] = [];
  const repoRoot = trimTrailingSlash(repoPath).toLowerCase();
  let current: WorktreeInventoryRow | null = null;

  const flush = () => {
    if (!current) {
      return;
    }
    rows.push(current);
    current = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.length) {
      flush();
      return;
    }
    if (trimmed.startsWith("worktree ")) {
      flush();
      const path = trimmed.slice("worktree ".length);
      current = {
        path,
        branch: null,
        head: null,
        isCurrent: trimTrailingSlash(path).toLowerCase() === repoRoot,
        isDetached: false,
        isBare: false,
        isPrunable: false,
        prunableReason: null,
        linkedThreadId: linkedThreadIdFromWorktreePath(path),
      };
      return;
    }
    if (!current) {
      return;
    }
    if (trimmed.startsWith("HEAD ")) {
      current.head = trimmed.slice("HEAD ".length).trim() || null;
      return;
    }
    if (trimmed.startsWith("branch ")) {
      const ref = trimmed.slice("branch ".length).trim();
      current.branch = ref ? branchFromRef(ref) : null;
      return;
    }
    if (trimmed === "detached") {
      current.isDetached = true;
      return;
    }
    if (trimmed === "bare") {
      current.isBare = true;
      return;
    }
    if (trimmed.startsWith("prunable")) {
      current.isPrunable = true;
      current.prunableReason = trimmed.slice("prunable".length).trim() || null;
    }
  });
  flush();
  return rows;
}

function isCancelled(signal?: AbortSignal | null) {
  return Boolean(signal?.aborted);
}

function assertNotCancelled(signal?: AbortSignal | null) {
  if (isCancelled(signal)) {
    throw new WorkspaceCreationCancelledError();
  }
}

async function runGit(args: string[], cwd: string) {
  return execCommand({ command: ["git", ...args], cwd });
}

export async function listWorktrees(repoPath: string) {
  const result = await runGit(["worktree", "list", "--porcelain"], repoPath);
  ensureSuccess(result, "List git worktrees");
  return parseWorktreeListPorcelain(result.stdout, repoPath);
}

export async function removeWorktree(repoPath: string, targetPath: string) {
  const normalizedRepo = trimTrailingSlash(repoPath).toLowerCase();
  const normalizedTarget = trimTrailingSlash(targetPath).toLowerCase();
  if (normalizedRepo === normalizedTarget) {
    throw new Error("Cannot remove the main workspace worktree.");
  }
  const result = await runGit(
    ["worktree", "remove", "--force", targetPath],
    repoPath,
  );
  ensureSuccess(result, "Remove worktree");
  return result;
}

async function removeDirectory(path: string, logs: string[]) {
  const removeResult = await execCommand({
    command: [
      "node",
      "-e",
      "const fs=require('node:fs');const target=process.argv[1];try{fs.rmSync(target,{recursive:true,force:true});}catch(error){}",
      path,
    ],
  });
  appendCommandOutput(logs, removeResult, `Removing directory ${path}`);
}

async function cleanupCancelledWorkspace(params: {
  strategy: WorkspaceStrategy;
  repoPath: string;
  targetPath: string;
  logs: string[];
}) {
  if (params.strategy === "git_worktree") {
    const removeResult = await runGit(
      ["worktree", "remove", "--force", params.targetPath],
      params.repoPath,
    );
    appendCommandOutput(
      params.logs,
      removeResult,
      `Removing cancelled worktree ${params.targetPath}`,
    );
    return;
  }
  await removeDirectory(params.targetPath, params.logs);
}

async function currentBranch(cwd: string) {
  const branchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  ensureSuccess(branchResult, "Read current branch");
  return branchResult.stdout.trim();
}

async function gitCommonDir(cwd: string) {
  const result = await runGit(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );
  ensureSuccess(result, "Read git common dir");
  return normalizePath(result.stdout.trim());
}

export async function createWorkspace(
  request: WorkspaceCreateRequest,
  options?: { signal?: AbortSignal },
): Promise<WorkspaceCreateResult> {
  const signal = options?.signal ?? null;
  const logs: string[] = [];
  assertNotCancelled(signal);

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
  assertNotCancelled(signal);

  try {
    if (request.strategy === "clone") {
      const cloneResult = await runGit(
        ["clone", "--no-checkout", normalizedRoot, targetPath],
        request.repoPath,
      );
      appendCommandOutput(logs, cloneResult, "Cloning workspace");
      ensureSuccess(cloneResult, "Clone workspace");
      assertNotCancelled(signal);

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
    assertNotCancelled(signal);
  } catch (error) {
    if (
      error instanceof WorkspaceCreationCancelledError ||
      isCancelled(signal)
    ) {
      await cleanupCancelledWorkspace({
        strategy: request.strategy,
        repoPath: request.repoPath,
        targetPath,
        logs,
      });
      throw new WorkspaceCreationCancelledError();
    }
    throw error;
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
  request: MergeWorkspaceRequest,
): Promise<MergeWorkspaceResult> {
  const logs: string[] = [];
  const sourceCommonDir = await gitCommonDir(request.workspacePath);
  const targetCommonDir = await gitCommonDir(request.repoPath);
  if (sourceCommonDir !== targetCommonDir) {
    throw new Error(
      "Bring back to main currently supports git worktree paths that share the same repository.",
    );
  }

  const sourceBranch = await currentBranch(request.workspacePath);
  if (!sourceBranch) {
    throw new Error("Unable to resolve source branch.");
  }
  if (sourceBranch === request.targetBranch) {
    throw new Error("Already on the target branch.");
  }

  if (request.strategy === "rebase") {
    const rebaseResult = await runGit(
      ["rebase", request.targetBranch],
      request.workspacePath,
    );
    appendCommandOutput(logs, rebaseResult, `Rebasing ${sourceBranch}`);
    ensureSuccess(rebaseResult, "Rebase source branch");
  }

  const checkoutTargetResult = await runGit(
    ["checkout", request.targetBranch],
    request.repoPath,
  );
  appendCommandOutput(
    logs,
    checkoutTargetResult,
    `Checking out ${request.targetBranch}`,
  );
  ensureSuccess(checkoutTargetResult, "Checkout target branch");

  const mergeArgs =
    request.strategy === "merge"
      ? ["merge", "--no-ff", sourceBranch]
      : request.strategy === "rebase"
        ? ["merge", "--ff-only", sourceBranch]
        : ["merge", "--squash", sourceBranch];
  const mergeResult = await runGit(mergeArgs, request.repoPath);
  appendCommandOutput(logs, mergeResult, `Merging ${sourceBranch}`);
  ensureSuccess(mergeResult, "Merge branch");

  if (request.strategy === "squash") {
    const commitResult = await runGit(
      ["commit", "-m", `Merge ${sourceBranch} into ${request.targetBranch}`],
      request.repoPath,
    );
    appendCommandOutput(logs, commitResult, "Committing squash merge");
    ensureSuccess(commitResult, "Commit squash merge");
  }

  if (
    request.removeWorktree &&
    normalizePath(request.workspacePath) !== normalizePath(request.repoPath)
  ) {
    const removeResult = await runGit(
      ["worktree", "remove", "--force", request.workspacePath],
      request.repoPath,
    );
    appendCommandOutput(logs, removeResult, "Removing merged worktree");
    ensureSuccess(removeResult, "Remove merged worktree");
  }

  return {
    sourceBranch,
    targetBranch: request.targetBranch,
    logs,
  };
}
