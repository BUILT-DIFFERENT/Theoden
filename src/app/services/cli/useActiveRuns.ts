import { useEffect, useMemo, useState } from "react";

import {
  getActiveRuns,
  subscribeActiveRuns,
} from "@/app/services/cli/activeRuns";
import type { RunSummary, ThreadSummary } from "@/app/types";

function mapStatusLabel(status: RunSummary["status"]) {
  if (status === "needs_review") return "Needs review";
  if (status === "failed") return "Failed";
  if (status === "done") return "Done";
  return "Running";
}

export function useActiveRuns(threads: ThreadSummary[]) {
  const [entries, setEntries] = useState(getActiveRuns());

  useEffect(
    () => subscribeActiveRuns(() => setEntries(getActiveRuns())),
    [getActiveRuns, subscribeActiveRuns],
  );

  const threadById = useMemo(() => {
    return new Map(threads.map((thread) => [thread.id, thread]));
  }, [threads]);

  return useMemo(() => {
    return entries.map((entry) => {
      const match = threadById.get(entry.threadId);
      const title = match?.title ?? "Active run";
      return {
        id: `run-${entry.threadId}`,
        title,
        status: entry.status,
        statusLabel: mapStatusLabel(entry.status),
        threadId: entry.threadId,
        projectId: match?.projectId ?? "unknown",
      } satisfies RunSummary;
    });
  }, [entries, threadById]);
}
