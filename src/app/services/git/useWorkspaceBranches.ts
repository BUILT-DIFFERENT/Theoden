import { useQuery } from "@tanstack/react-query";

import { listWorkspaceBranches } from "@/app/services/git/branches";
import { isTauri } from "@/app/utils/tauri";

export function useWorkspaceBranches(workspacePath?: string | null) {
  const isDesktop = isTauri();
  const query = useQuery({
    queryKey: ["git", "branches", workspacePath],
    queryFn: () => listWorkspaceBranches(workspacePath ?? ""),
    enabled: isDesktop && Boolean(workspacePath),
    refetchInterval: isDesktop ? 30000 : false,
    refetchIntervalInBackground: false,
  });

  return {
    branches: query.data ?? [],
    isLoading: isDesktop ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
