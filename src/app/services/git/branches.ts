import { execCommand } from "@/app/services/cli/commands";

const NEWLINE_REGEX = /\r?\n/;

export async function listWorkspaceBranches(cwd: string) {
  const result = await execCommand({
    command: ["git", "branch", "--format=%(refname:short)"],
    cwd,
  });
  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || result.stdout.trim();
    throw new Error(`List git branches failed${message ? `: ${message}` : ""}`);
  }

  return result.stdout
    .split(NEWLINE_REGEX)
    .map((line) => line.trim())
    .filter(Boolean);
}
