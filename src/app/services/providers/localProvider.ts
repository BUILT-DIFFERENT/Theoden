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

export const LocalProvider: Provider = {
  id: "local",
  status: "ready",
  displayName: "Local CLI",
  async startRun(_request: RunRequest) {
    // Placeholder: launch `codex app-server` and start a thread/turn.
    const now = Date.now();
    await startAppServer({ cwd: _request.repoPath });
    await sendAppServerRequest({
      id: now,
      method: "thread/start",
      params: {
        cwd: _request.repoPath,
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
      id: `local-${now}`,
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
