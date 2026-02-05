import {
  CloudProvider,
  LocalProvider,
  WorktreeProvider,
  type Provider,
  type RunRequest,
} from "@/app/services/providers";

const providers: Record<Provider["id"], Provider> = {
  local: LocalProvider,
  worktree: WorktreeProvider,
  cloud: CloudProvider,
};

export function getProvider(id: Provider["id"]) {
  return providers[id];
}

export async function startRun(request: RunRequest) {
  const provider = getProvider(request.mode);
  return provider.startRun(request);
}
