import type { Provider, RunRequest } from "@/app/services/providers/types";
import { runCli } from "@/app/services/cli/runner";

export const CloudProvider: Provider = {
  id: "cloud",
  status: "stub",
  displayName: "Cloud Runner",
  async startRun(_request: RunRequest) {
    // Placeholder: run `codex cloud exec` and stream events into the thread.
    const envId = _request.cloud?.environmentId ?? "env-id";
    await runCli({
      args: [
        "cloud",
        "exec",
        "--env",
        envId,
        ...(_request.cloud?.branch ? ["--branch", _request.cloud.branch] : []),
        ...(_request.cloud?.attempts ? ["--attempts", String(_request.cloud.attempts)] : []),
        _request.prompt
      ],
      cwd: _request.repoPath
    });
    throw new Error("Cloud provider not implemented yet.");
  }
};
