import type { WorkspaceStrategy } from "@/app/types";

export interface WorkspaceCreateRequest {
  repoPath: string;
  threadId: string;
  baseBranch: string;
  strategy: WorkspaceStrategy;
  targetPath?: string;
}

export interface WorkspaceInfo {
  id: string;
  path: string;
  branch: string;
  strategy: WorkspaceStrategy;
}

export async function createWorkspace(_request: WorkspaceCreateRequest): Promise<WorkspaceInfo> {
  return {
    id: `ws-${Date.now()}`,
    path: "",
    branch: "",
    strategy: _request.strategy
  };
}

export async function mergeWorkspace(
  _workspaceId: string,
  _targetBranch: string,
  _strategy: "rebase" | "merge" | "squash"
) {
  return;
}
