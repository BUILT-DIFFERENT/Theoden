import { invoke } from "@tauri-apps/api/core";

export interface CliRunRequest extends Record<string, unknown> {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface CliRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runCli(request: CliRunRequest): Promise<CliRunResult> {
  // Placeholder: run Codex CLI commands like `codex cloud exec`.
  return invoke("run_cli", request);
}
