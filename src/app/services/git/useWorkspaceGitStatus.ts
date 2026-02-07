import { useQuery } from "@tanstack/react-query";

import { getGitWorkspaceStatus } from "@/app/services/git/status";
import { isTauri } from "@/app/utils/tauri";

export function useWorkspaceGitStatus(workspacePath?: string | null) {
  const isDesktop = isTauri();
  const query = useQuery({
    queryKey: ["git", "status", workspacePath],
    queryFn: () => getGitWorkspaceStatus(workspacePath ?? ""),
    enabled: isDesktop && Boolean(workspacePath),
    refetchInterval: isDesktop ? 10000 : false,
    refetchIntervalInBackground: false,
  });

  return {
    status: query.data,
    isLoading: isDesktop ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
