import { execCommand } from "@/app/services/cli/commands";

interface GitWorkspaceDiffOptions {
  cwd: string;
  path: string;
  staged?: boolean;
}

function ensureSuccess(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
}) {
  if (result.exitCode === 0) {
    return;
  }
  const message = result.stderr.trim() || result.stdout.trim();
  throw new Error(`Read git diff failed${message ? `: ${message}` : ""}`);
}

export async function getGitWorkspaceDiff({
  cwd,
  path,
  staged = false,
}: GitWorkspaceDiffOptions) {
  const command = staged
    ? ["git", "diff", "--cached", "--", path]
    : ["git", "diff", "--", path];
  const result = await execCommand({ command, cwd });
  ensureSuccess(result);
  return result.stdout;
}
