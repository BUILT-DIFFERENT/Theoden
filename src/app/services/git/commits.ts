import {
  execCommand,
  type CommandExecResult,
} from "@/app/services/cli/commands";

export interface CommitResult {
  branch: string;
  logs: string[];
}

export interface PrPrerequisiteStatus {
  ready: boolean;
  reason?: string;
  steps: string[];
  account?: string;
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

async function ensureGhAvailable(cwd: string) {
  try {
    const result = await execCommand({ command: ["gh", "--version"], cwd });
    ensureSuccess(result, "Check gh version");
  } catch {
    throw new Error(
      "GitHub CLI (gh) is not available. Install it and run `gh auth login` before creating a PR.",
    );
  }
}

function parseGhAccount(output: string) {
  const match = output.match(/Logged in to [^\s]+ as (\S+)/i);
  return match?.[1];
}

export async function getPrPrerequisiteStatus(
  cwd: string,
): Promise<PrPrerequisiteStatus> {
  const installSteps = [
    "Install GitHub CLI from https://cli.github.com/.",
    "Re-open Codex after installation.",
  ];
  const authSteps = [
    "Run `gh auth login` in this repository.",
    "Run `gh auth status` to confirm authentication.",
  ];

  try {
    const version = await execCommand({ command: ["gh", "--version"], cwd });
    if (version.exitCode !== 0) {
      return {
        ready: false,
        reason: "GitHub CLI is not installed.",
        steps: installSteps,
      };
    }
  } catch {
    return {
      ready: false,
      reason: "GitHub CLI is not installed.",
      steps: installSteps,
    };
  }

  const authStatus = await execCommand({
    command: ["gh", "auth", "status"],
    cwd,
  });
  const combinedOutput = `${authStatus.stdout}\n${authStatus.stderr}`.trim();
  if (authStatus.exitCode !== 0) {
    return {
      ready: false,
      reason: "GitHub CLI is installed but not authenticated.",
      steps: authSteps,
    };
  }
  return {
    ready: true,
    steps: [],
    account: parseGhAccount(combinedOutput),
  };
}

function summarizeCommitMessage(files: string[]) {
  if (!files.length) return "Update files";
  if (files.length === 1) return `Update ${files[0]}`;
  if (files.length === 2) return `Update ${files[0]} and ${files[1]}`;
  return `Update ${files[0]} and ${files.length - 1} more files`;
}

export async function getCurrentBranch(cwd: string) {
  const result = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  ensureSuccess(result, "Read current branch");
  return result.stdout.trim();
}

export async function commitChanges(options: {
  cwd: string;
  message?: string;
  includeUnstaged: boolean;
}) {
  const logs: string[] = [];
  if (options.includeUnstaged) {
    const addResult = await runGit(["add", "-A"], options.cwd);
    appendCommandOutput(logs, addResult, "Staging changes");
    ensureSuccess(addResult, "Stage changes");
  }

  const diffResult = await runGit(
    ["diff", "--staged", "--name-only"],
    options.cwd,
  );
  appendCommandOutput(logs, diffResult, "Collecting staged files");
  ensureSuccess(diffResult, "Collect staged files");
  const files = diffResult.stdout
    .split(NEWLINE_REGEX)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!files.length) {
    throw new Error("No staged changes to commit.");
  }

  let message = options.message?.trim();
  if (!message) {
    message = summarizeCommitMessage(files);
  }

  const commitResult = await runGit(["commit", "-m", message], options.cwd);
  appendCommandOutput(logs, commitResult, "Creating commit");
  ensureSuccess(commitResult, "Create commit");

  const branch = await getCurrentBranch(options.cwd);
  return { branch, logs } satisfies CommitResult;
}

export async function pushBranch(cwd: string, branch: string) {
  const logs: string[] = [];
  const pushResult = await runGit(["push"], cwd);
  appendCommandOutput(logs, pushResult, "Pushing branch");
  if (pushResult.exitCode === 0) return logs;
  if (pushResult.exitCode !== 0 && pushResult.stderr.includes("no upstream")) {
    const upstreamResult = await runGit(["push", "-u", "origin", branch], cwd);
    appendCommandOutput(logs, upstreamResult, "Setting upstream");
    ensureSuccess(upstreamResult, "Set upstream");
    return logs;
  }
  ensureSuccess(pushResult, "Push branch");
  return logs;
}

export async function createPullRequest(cwd: string) {
  const logs: string[] = [];
  await ensureGhAvailable(cwd);
  const prerequisiteStatus = await getPrPrerequisiteStatus(cwd);
  if (!prerequisiteStatus.ready) {
    const reason = prerequisiteStatus.reason ?? "PR prerequisites are not met.";
    const steps = prerequisiteStatus.steps.length
      ? ` Next steps: ${prerequisiteStatus.steps.join(" ")}`
      : "";
    throw new Error(`${reason}${steps}`);
  }
  const prResult = await execCommand({
    command: ["gh", "pr", "create", "--fill"],
    cwd,
  });
  appendCommandOutput(logs, prResult, "Creating PR");
  ensureSuccess(prResult, "Create PR");
  return logs;
}
