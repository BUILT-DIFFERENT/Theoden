import { useQuery } from "@tanstack/react-query";

import { listCloudTasks } from "@/app/services/cli/cloudTasks";
import { isTauri } from "@/app/utils/tauri";

export function useCloudTasks(params: { limit?: number } = {}) {
  const isDesktop = isTauri();
  const limit = params.limit ?? 10;
  const query = useQuery({
    queryKey: ["cloud", "tasks", limit],
    queryFn: () => listCloudTasks({ limit }),
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
    refetchInterval: isDesktop ? 45000 : false,
    refetchIntervalInBackground: false,
  });

  return {
    tasks: query.data?.tasks ?? [],
    cursor: query.data?.cursor ?? null,
    isLoading: isDesktop ? query.isPending : false,
    error: query.error,
    refetch: query.refetch,
  };
}
