import { runCli } from "@/app/services/cli/runner";
import type { Provider, RunRequest } from "@/app/services/providers/types";

export const CloudProvider: Provider = {
  id: "cloud",
  status: "ready",
  displayName: "Cloud Runner",
  async startRun(request: RunRequest) {
    const envId = request.cloud?.environmentId?.trim();
    if (!envId) {
      throw new Error("Cloud environment is required.");
    }
    const attempts = Math.min(Math.max(request.cloud?.attempts ?? 1, 1), 4);
    const result = await runCli({
      args: [
        "cloud",
        "exec",
        "--env",
        envId,
        "--attempts",
        String(attempts),
        ...(request.cloud?.branch ? ["--branch", request.cloud.branch] : []),
        request.prompt,
      ],
      cwd: request.repoPath,
    });
    if (result.code !== 0) {
      throw new Error(
        result.stderr.trim() || result.stdout.trim() || "Cloud run failed.",
      );
    }
    const now = Date.now();
    return {
      handle: {
        id: `cloud-${now}`,
        stop: () => Promise.resolve(),
      },
      stream: {
        onEvent: () => {},
        onComplete: () => {},
        onError: () => {},
      },
    };
  },
};
