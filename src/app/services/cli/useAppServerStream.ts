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
import { registerAutomationRunNotification } from "@/app/services/cli/automationRuns";
import { registerDiffNotification } from "@/app/services/cli/diffUpdates";
import { registerTerminalNotification } from "@/app/services/cli/terminalSessions";
import { isTauri } from "@/app/utils/tauri";

export function useAppServerStream() {
  useEffect(() => {
    if (!isTauri()) return;
    const unlistenNotification = subscribeAppServerNotifications(
      (notification) => {
        registerActiveRunNotification(notification);
        registerApprovalItem(notification);
        registerDiffNotification(notification);
        registerTerminalNotification(notification);
        registerAutomationRunNotification(notification);
      },
    );
    const unlistenRequest = subscribeAppServerRequests((request) => {
      registerApprovalRequest(request);
    });

    return () => {
      unlistenNotification();
      unlistenRequest();
    };
  }, []);
}
