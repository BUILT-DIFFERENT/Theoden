import { execCommand } from "@/app/services/cli/commands";

const CACHE_TTL_MS = 45_000;
const MAX_INDEXED_FILES = 20_000;

interface WorkspaceFileIndexEntry {
  files: string[];
  createdAt: number;
}

const workspaceFileIndexCache = new Map<string, WorkspaceFileIndexEntry>();

function normalizeWorkspacePath(path: string) {
  return path.replace(/[\\/]+$/, "").toLowerCase();
}

function parseCommandOutput(output: string) {
  return Array.from(
    new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_INDEXED_FILES);
}

async function listWorkspaceFilesWithRg(workspacePath: string) {
  const result = await execCommand({
    cwd: workspacePath,
    command: [
      "rg",
      "--files",
      "--hidden",
      "--glob",
      "!.git/**",
      "--glob",
      "!node_modules/**",
    ],
  });
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || "rg failed",
    );
  }
  return parseCommandOutput(result.stdout);
}

async function listWorkspaceFilesWithGit(workspacePath: string) {
  const tracked = await execCommand({
    cwd: workspacePath,
    command: ["git", "ls-files"],
  });
  if (tracked.exitCode !== 0) {
    throw new Error(
      tracked.stderr.trim() || tracked.stdout.trim() || "git ls-files failed",
    );
  }
  const untracked = await execCommand({
    cwd: workspacePath,
    command: ["git", "ls-files", "--others", "--exclude-standard"],
  });
  const combined =
    untracked.exitCode === 0
      ? `${tracked.stdout}\n${untracked.stdout}`
      : tracked.stdout;
  return parseCommandOutput(combined);
}

export async function getWorkspaceFileIndex(
  workspacePath: string,
  forceRefresh = false,
) {
  const cacheKey = normalizeWorkspacePath(workspacePath);
  const cached = workspaceFileIndexCache.get(cacheKey);
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.createdAt <= CACHE_TTL_MS
  ) {
    return cached.files;
  }

  let files: string[];
  try {
    files = await listWorkspaceFilesWithRg(workspacePath);
  } catch {
    files = await listWorkspaceFilesWithGit(workspacePath);
  }

  workspaceFileIndexCache.set(cacheKey, {
    files,
    createdAt: Date.now(),
  });
  return files;
}
