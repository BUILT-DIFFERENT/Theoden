import { execCommand } from "@/app/services/cli/commands";

function ensureSuccess(
  result: { exitCode: number; stdout: string; stderr: string },
  action: string,
) {
  if (result.exitCode === 0) return;
  const message = result.stderr.trim() || result.stdout.trim();
  throw new Error(`${action} failed${message ? `: ${message}` : ""}`);
}

async function runGit(args: string[], cwd: string) {
  return execCommand({ command: ["git", ...args], cwd });
}

export async function stagePath(cwd: string, path: string) {
  const result = await runGit(["add", "--", path], cwd);
  ensureSuccess(result, "Stage file");
}

export async function stageAllPaths(cwd: string) {
  const result = await runGit(["add", "-A"], cwd);
  ensureSuccess(result, "Stage all files");
}

export async function unstagePath(cwd: string, path: string) {
  const restoreResult = await runGit(["restore", "--staged", "--", path], cwd);
  if (restoreResult.exitCode === 0) {
    return;
  }

  const resetResult = await runGit(["reset", "HEAD", "--", path], cwd);
  ensureSuccess(resetResult, "Unstage file");
}

export async function revertPath(
  cwd: string,
  path: string,
  includeStaged: boolean,
) {
  if (includeStaged) {
    const result = await runGit(
      ["restore", "--source=HEAD", "--staged", "--worktree", "--", path],
      cwd,
    );
    ensureSuccess(result, "Revert staged file");
    return;
  }

  const result = await runGit(["restore", "--worktree", "--", path], cwd);
  ensureSuccess(result, "Revert file");
}

export async function revertAllPaths(cwd: string, includeStaged: boolean) {
  if (includeStaged) {
    const result = await runGit(
      ["restore", "--source=HEAD", "--staged", "--worktree", "--", "."],
      cwd,
    );
    ensureSuccess(result, "Revert all staged files");
    return;
  }

  const result = await runGit(["restore", "--worktree", "--", "."], cwd);
  ensureSuccess(result, "Revert all files");
}
