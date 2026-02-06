export type RunStatus =
  | "queued"
  | "running"
  | "needs_review"
  | "done"
  | "failed";
export type RunMode = "local" | "worktree" | "cloud";
export type WorkspaceStrategy = "clone" | "git_worktree";

export interface RunEvent {
  id: string;
  timestamp: string;
  label: string;
  detail?: string;
  status: RunStatus;
}

export interface RunSummary {
  id: string;
  title: string;
  status: RunStatus;
  statusLabel: string;
  threadId: string;
  projectId: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  subtitle: string;
  status: RunStatus;
  projectId: string;
  lastUpdated: string;
  modelProvider?: string;
  source?: string;
}

export interface ThreadDetail extends ThreadSummary {
  mode: RunMode;
  worktreeStrategy?: WorkspaceStrategy;
  worktreePath?: string;
  branch?: string;
  effort: "medium" | "high" | "extra_high";
  events: RunEvent[];
  attachments: ThreadAttachment[];
  diffSummary: DiffSummary;
  diffText?: string;
}

export interface ThreadAttachment {
  id: string;
  kind: "image" | "file";
  name: string;
  path: string;
}

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface DiffSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
  files: DiffFile[];
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted";
}

export interface Project {
  id: string;
  name: string;
  path: string;
  tags: string[];
  activeRuns: RunSummary[];
  recentThreads: ThreadSummary[];
  lastThreadId: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
  trustLevel?: "trusted" | "untrusted";
  source: "config" | "threads" | "local";
}

export interface EditorOption {
  id: string;
  name: string;
  detected: boolean;
  command: string;
}

export interface WorktreeSummary {
  id: string;
  path: string;
  branch: string;
  threadId: string;
  status: "active" | "merged" | "kept";
  strategy: WorkspaceStrategy;
}

export interface AutomationSummary {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun: string;
  nextRun: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  permissions: string[];
}

export interface RemoteSkillSummary {
  id: string;
  name: string;
  description: string;
  publisher: string;
  tags: string[];
  installable: boolean;
}

export interface CloudTaskSummary {
  id: string;
  title?: string;
  url?: string;
  environment: string;
  status: "queued" | "running" | "completed" | "failed";
  updatedAt: string;
  branch?: string;
  filesChanged?: number;
  linesAdded?: number;
  linesRemoved?: number;
  isReview?: boolean;
  attemptTotal?: number;
}

export interface ProviderStatus {
  id: "local" | "worktree" | "cloud";
  status: "ready" | "unavailable" | "stub";
  detail: string;
}
