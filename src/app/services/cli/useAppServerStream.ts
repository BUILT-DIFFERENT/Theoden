import { useEffect } from "react";

import { registerActiveRunNotification } from "@/app/services/cli/activeRuns";
import { registerApprovalItem } from "@/app/services/cli/approvals";
import {
  subscribeAppServerNotifications,
  subscribeAppServerRequests,
} from "@/app/services/cli/appServerEventHub";
import { registerAutomationRunNotification } from "@/app/services/cli/automationRuns";
import { registerConfigWarningNotification } from "@/app/services/cli/configWarnings";
import { registerDiffNotification } from "@/app/services/cli/diffUpdates";
import { handleAppServerRequest } from "@/app/services/cli/serverRequests";
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
        registerConfigWarningNotification(notification);
        registerTerminalNotification(notification);
        registerAutomationRunNotification(notification);
      },
    );
    const unlistenRequest = subscribeAppServerRequests((request) => {
      void handleAppServerRequest(request).catch((error) => {
        console.warn("Failed to handle app-server request", error);
      });
    });

    return () => {
      unlistenNotification();
      unlistenRequest();
    };
  }, []);
}
