import { useQuery } from "@tanstack/react-query";

import { readAccount } from "@/app/services/cli/account";
import { isTauri } from "@/app/utils/tauri";

export function useAccount() {
  const enabled = isTauri();
  const query = useQuery({
    queryKey: ["account", "read"],
    queryFn: readAccount,
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: enabled,
  });

  return {
    account: query.data,
    isLoading: enabled ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
