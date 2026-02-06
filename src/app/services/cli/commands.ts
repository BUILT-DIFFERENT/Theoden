import { sendAppServerRequest } from "@/app/services/cli/appServer";

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

let requestNonce = 0;

function requestId() {
  requestNonce += 1;
  return Date.now() + requestNonce;
}

export async function execCommand(
  params: CommandExecParams,
): Promise<CommandExecResult> {
  const response = await sendAppServerRequest<CommandExecResult>({
    id: requestId(),
    method: "command/exec",
    params,
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  if (!response.result) {
    throw new Error("command/exec returned no result");
  }
  return response.result;
}
