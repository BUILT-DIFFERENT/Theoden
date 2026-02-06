import { useMemo } from "react";

import { useAppServerEvents } from "@/app/services/cli/useAppServerEvents";
import type { RunEvent } from "@/app/types";

function progressFromEvents(events: RunEvent[]) {
  if (!events.length) return 0;
  const last = events[events.length - 1];
  if (last?.status === "done" || last?.status === "failed") return 100;
  if (last?.status === "needs_review") return 90;
  const uniqueLabels = new Set(events.map((event) => event.label));
  const estimated = 10 + uniqueLabels.size * 8;
  return Math.min(85, Math.max(10, estimated));
}

export function useRunProgress(threadId?: string) {
  const events = useAppServerEvents(threadId);

  return useMemo(() => {
    const percent = progressFromEvents(events);
    const isActive = percent > 0 && percent < 100;
    return { percent, isActive };
  }, [events]);
}
