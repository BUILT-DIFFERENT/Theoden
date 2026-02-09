import { useEffect, useState } from "react";

import { subscribeAppServerNotifications } from "@/app/services/cli/appServerEventHub";
import { getString } from "@/app/services/cli/appServerPayload";
import {
  cloudRunEvents,
  subscribeCloudRunEvents,
} from "@/app/services/cli/cloudRuns";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";
import type { RunEvent } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

const MAX_EVENTS = 200;

export function useAppServerEvents(threadId?: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [cloudEvents, setCloudEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    setEvents([]);
    setCloudEvents(cloudRunEvents(threadId));
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

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = subscribeCloudRunEvents(() => {
      setCloudEvents(cloudRunEvents(threadId));
    });
    return () => {
      unlisten();
    };
  }, [threadId]);

  return [...events, ...cloudEvents].slice(-MAX_EVENTS);
}
