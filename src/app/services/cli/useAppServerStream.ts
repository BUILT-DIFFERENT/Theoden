import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { registerActiveRunNotification } from "@/app/services/cli/activeRuns";
import {
  registerApprovalItem,
  registerApprovalRequest,
} from "@/app/services/cli/approvals";
import {
  subscribeAppServerNotifications,
  subscribeAppServerRequests,
} from "@/app/services/cli/appServerEventHub";
import { registerAuthNotification } from "@/app/services/cli/authNotifications";
import { registerAutomationRunNotification } from "@/app/services/cli/automationRuns";
import { reloadMcpServerConnections } from "@/app/services/cli/config";
import { registerDiffNotification } from "@/app/services/cli/diffUpdates";
import { registerTerminalNotification } from "@/app/services/cli/terminalSessions";
import { isTauri } from "@/app/utils/tauri";

export function useAppServerStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isTauri()) return;
    const unlistenNotification = subscribeAppServerNotifications(
      (notification) => {
        registerActiveRunNotification(notification);
        registerApprovalItem(notification);
        registerDiffNotification(notification);
        registerTerminalNotification(notification);
        registerAutomationRunNotification(notification);
        const authNotifications = registerAuthNotification(notification);
        if (
          authNotifications.accountLoginCompleted ||
          notification.method === "account/updated" ||
          notification.method === "authStatusChange"
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["account", "read"],
          });
        }
        if (authNotifications.mcpOauthLoginCompleted) {
          void reloadMcpServerConnections().catch(() => undefined);
        }
      },
    );
    const unlistenRequest = subscribeAppServerRequests((request) => {
      registerApprovalRequest(request);
    });

    return () => {
      unlistenNotification();
      unlistenRequest();
    };
  }, [queryClient]);
}
