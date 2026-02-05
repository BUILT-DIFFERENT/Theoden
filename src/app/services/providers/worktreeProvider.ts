import {
  sendAppServerRequest,
  startAppServer,
} from "@/app/services/cli/appServer";
import type {
  Provider,
  RunEventStream,
  RunHandle,
  RunRequest,
} from "@/app/services/providers/types";

export const WorktreeProvider: Provider = {
  id: "worktree",
  status: "ready",
  displayName: "Worktree Runner",
  async startRun(_request: RunRequest) {
    // Placeholder: launch `codex app-server` in a workspace clone.
    const now = Date.now();
    const cwd = _request.workspacePath ?? _request.repoPath;
    await startAppServer({ cwd });
    await sendAppServerRequest({
      id: now,
      method: "thread/start",
      params: {
        cwd,
      },
    });
    await sendAppServerRequest({
      id: now + 1,
      method: "turn/start",
      params: {
        threadId: "thread-id-from-start",
        input: [{ type: "text", text: _request.prompt }],
        effort: _request.effort,
      },
    });
    const handle: RunHandle = {
      id: `worktree-${now}`,
      stop: () => Promise.resolve(),
    };

    const stream: RunEventStream = {
      onEvent: () => {},
      onComplete: () => {},
      onError: () => {},
    };

    return { handle, stream };
  },
};
