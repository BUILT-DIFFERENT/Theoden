import { requestAppServer } from "@/app/services/cli/rpc";
import {
  getCommandPermissionProfile,
  sandboxPolicyForProfile,
} from "@/app/state/commandPolicy";

export interface CommandExecParams {
  command: string[];
  cwd?: string;
  timeoutMs?: number;
  sandboxPolicy?: unknown;
}

export interface CommandExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function execCommand(
  params: CommandExecParams,
): Promise<CommandExecResult> {
  const sandboxPolicy =
    params.sandboxPolicy ??
    sandboxPolicyForProfile(getCommandPermissionProfile());
  const result = await requestAppServer<CommandExecResult>({
    method: "command/exec",
    params: {
      ...params,
      sandboxPolicy,
    },
  });
  if (!result) {
    throw new Error("command/exec returned no result");
  }
  return result;
}
