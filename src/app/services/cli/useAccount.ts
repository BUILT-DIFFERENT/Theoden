import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { readAccount, type AccountInfo } from "@/app/services/cli/account";
import { subscribeAppServerNotifications } from "@/app/services/cli/appServerEventHub";
import { isTauri } from "@/app/utils/tauri";

export function useAccount() {
  const enabled = isTauri();
  const queryClient = useQueryClient();
  const query = useQuery<AccountInfo>({
    queryKey: ["account", "read"],
    queryFn: () => readAccount(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return subscribeAppServerNotifications((notification) => {
      if (
        notification.method === "account/updated" ||
        notification.method === "account/login/completed"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["account", "read"] });
      }
    });
  }, [enabled, queryClient]);

  return {
    account: query.data,
    isLoading: enabled ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
