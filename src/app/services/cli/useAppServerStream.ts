import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@/app/utils/tauri";
import { registerActiveRunNotification } from "@/app/services/cli/activeRuns";
import { registerApprovalRequest } from "@/app/services/cli/approvals";

export function useAppServerStream() {
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenNotification: (() => void) | null = null;
    let unlistenRequest: (() => void) | null = null;

    listen("app-server-notification", (event) => {
      registerActiveRunNotification(event.payload as any);
    }).then((stop) => {
      unlistenNotification = stop;
    });

    listen("app-server-request", (event) => {
      const payload = event.payload as any;
      if (!payload?.id || !payload?.method) return;
      registerApprovalRequest({
        id: payload.id,
        method: payload.method,
        params: payload.params
      });
    }).then((stop) => {
      unlistenRequest = stop;
    });

    return () => {
      if (unlistenNotification) unlistenNotification();
      if (unlistenRequest) unlistenRequest();
    };
  }, []);
}
