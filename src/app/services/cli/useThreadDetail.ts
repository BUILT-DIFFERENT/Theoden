import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  diffTextFromTurns,
  summarizeTurns,
} from "@/app/services/cli/diffSummary";
import { readThread } from "@/app/services/cli/threads";
import { buildTimelineFromTurns } from "@/app/services/cli/timeline";
import { mockThreadDetail } from "@/app/state/mockData";
import { getThreadMetadata } from "@/app/state/threadMetadata";
import type { ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { formatRelativeTimeFromSeconds } from "@/app/utils/time";

export function useThreadDetail(threadId: string | undefined) {
  const isDesktop = isTauri();
  const query = useQuery({
    queryKey: ["threads", "read", threadId],
    queryFn: () => readThread(threadId ?? "", true),
    enabled: isDesktop && Boolean(threadId),
  });

  const thread = useMemo(() => {
    if (!isDesktop || !threadId) {
      return mockThreadDetail;
    }
    if (!query.data) {
      return undefined;
    }
    const metadata = getThreadMetadata(threadId);
    return {
      id: query.data.id,
      title: query.data.preview?.trim() || "Untitled thread",
      subtitle: query.data.cwd,
      status: "done",
      projectId: query.data.cwd,
      lastUpdated: formatRelativeTimeFromSeconds(query.data.updatedAt),
      mode: "local",
      effort: "medium",
      worktreePath: metadata.worktreePath,
      branch: metadata.branch ?? query.data.gitInfo?.branch,
      events: buildTimelineFromTurns(query.data.turns ?? []),
      attachments: [],
      diffSummary: summarizeTurns(query.data.turns ?? []),
      diffText: diffTextFromTurns(query.data.turns ?? []),
    } satisfies ThreadDetail;
  }, [isDesktop, mockThreadDetail, query.data, threadId]);

  if (!isDesktop || !threadId) {
    return { thread, isLoading: false };
  }

  return { thread, isLoading: query.isPending };
}
