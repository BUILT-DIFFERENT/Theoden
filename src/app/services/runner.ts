import type { Provider, RunRequest } from "@/app/services/providers";
import { CloudProvider, LocalProvider, WorktreeProvider } from "@/app/services/providers";

const providers: Record<Provider["id"], Provider> = {
  local: LocalProvider,
  worktree: WorktreeProvider,
  cloud: CloudProvider
};

export function getProvider(id: Provider["id"]) {
  return providers[id];
}

export async function startRun(request: RunRequest) {
  const provider = getProvider(request.mode);
  return provider.startRun(request);
}
