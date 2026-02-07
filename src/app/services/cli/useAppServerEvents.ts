import { useEffect, useState } from "react";

import { subscribeAppServerNotifications } from "@/app/services/cli/appServerEventHub";
import { getString } from "@/app/services/cli/appServerPayload";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";
import type { RunEvent } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

const MAX_EVENTS = 200;

export function useAppServerEvents(threadId?: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    setEvents([]);
  }, [threadId]);

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = subscribeAppServerNotifications((notification) => {
      if (threadId) {
        const payloadThreadId = notification.params
          ? getString(notification.params, "threadId")
          : undefined;
        if (payloadThreadId && payloadThreadId !== threadId) return;
      }
      const mapped = mapNotificationToRunEvent(notification);
      if (!mapped) return;
      setEvents((prev) => [...prev, mapped].slice(-MAX_EVENTS));
    });

    return () => {
      unlisten();
    };
  }, [threadId]);

  return events;
}
