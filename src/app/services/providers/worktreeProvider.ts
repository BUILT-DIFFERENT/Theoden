import type { Provider, RunRequest } from "@/app/services/providers/types";
import { sendAppServerRequest, startAppServer } from "@/app/services/cli/appServer";

export const WorktreeProvider: Provider = {
  id: "worktree",
  status: "ready",
  displayName: "Worktree Runner",
  async startRun(_request: RunRequest) {
    // Placeholder: launch `codex app-server` in a workspace clone.
    const cwd = _request.workspacePath ?? _request.repoPath;
    await startAppServer({ cwd });
    await sendAppServerRequest({
      id: Date.now(),
      method: "thread/start",
      params: {
        cwd
      }
    });
    await sendAppServerRequest({
      id: Date.now() + 1,
      method: "turn/start",
      params: {
        threadId: "thread-id-from-start",
        input: [{ type: "text", text: _request.prompt }],
        effort: _request.effort
      }
    });
    const handle = {
      id: `worktree-${Date.now()}`,
      stop: async () => {
        return;
      }
    };

    const stream = {
      onEvent: (_handler: (event: any) => void) => {
        return;
      },
      onComplete: (_handler: (thread: any) => void) => {
        return;
      },
      onError: (_handler: (error: Error) => void) => {
        return;
      }
    };

    return { handle, stream };
  }
};
