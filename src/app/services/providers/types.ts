import type { RunEvent, RunMode, ThreadDetail, WorkspaceStrategy } from "@/app/types";

export interface RunRequest {
  threadId?: string;
  projectId: string;
  repoPath: string;
  prompt: string;
  mode: RunMode;
  effort: "medium" | "high" | "extra_high";
  attachments?: string[];
  skillIds?: string[];
  worktreeStrategy?: WorkspaceStrategy;
  workspacePath?: string;
  cloud?: {
    environmentId: string;
    branch?: string;
    attempts?: number;
  };
}

export interface RunHandle {
  id: string;
  stop: () => Promise<void>;
}

export interface RunEventStream {
  onEvent: (handler: (event: RunEvent) => void) => void;
  onComplete: (handler: (thread: ThreadDetail) => void) => void;
  onError: (handler: (error: Error) => void) => void;
}

export interface Provider {
  id: "local" | "worktree" | "cloud";
  status: "ready" | "unavailable" | "stub";
  displayName: string;
  startRun: (request: RunRequest) => Promise<{ handle: RunHandle; stream: RunEventStream }>;
}
