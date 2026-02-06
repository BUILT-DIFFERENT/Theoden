import { execCommand } from "@/app/services/cli/commands";

export interface GitWorkspaceStatus {
  branch: string | null;
  ahead: number;
  behind: number;
  stagedPaths: string[];
  unstagedPaths: string[];
}

function parseBranchHeader(line: string) {
  const content = line.replace(/^##\s*/, "");
  const branchMatch = content.match(/^([^\s.]+)/);
  const aheadMatch = content.match(/ahead (\d+)/);
  const behindMatch = content.match(/behind (\d+)/);
  return {
    branch: branchMatch?.[1] ?? null,
    ahead: aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0,
    behind: behindMatch ? Number.parseInt(behindMatch[1], 10) : 0,
  };
}

function parseStatusPath(raw: string) {
  if (raw.includes(" -> ")) {
    return raw.split(" -> ").at(-1)?.trim() ?? raw.trim();
  }
  return raw.trim();
}

export function parseGitStatusOutput(output: string): GitWorkspaceStatus {
  const stagedPaths = new Set<string>();
  const unstagedPaths = new Set<string>();
  let branch: string | null = null;
  let ahead = 0;
  let behind = 0;

  output.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    if (line.startsWith("##")) {
      const branchInfo = parseBranchHeader(line);
      branch = branchInfo.branch;
      ahead = branchInfo.ahead;
      behind = branchInfo.behind;
      return;
    }
    if (line.length < 4) return;
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    const path = parseStatusPath(line.slice(3));
    if (!path) return;

    if (indexStatus !== " " && indexStatus !== "?") {
      stagedPaths.add(path);
    }
    if (worktreeStatus !== " " || line.startsWith("??")) {
      unstagedPaths.add(path);
    }
  });

  return {
    branch,
    ahead,
    behind,
    stagedPaths: Array.from(stagedPaths),
    unstagedPaths: Array.from(unstagedPaths),
  };
}

export async function getGitWorkspaceStatus(
  cwd: string,
): Promise<GitWorkspaceStatus> {
  const result = await execCommand({
    command: ["git", "status", "--porcelain=v1", "--branch"],
    cwd,
  });
  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || result.stdout.trim();
    throw new Error(`Read git status failed${message ? `: ${message}` : ""}`);
  }
  return parseGitStatusOutput(result.stdout);
}
