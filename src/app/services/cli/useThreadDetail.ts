import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  diffTextFromTurns,
  summarizeTurns,
} from "@/app/services/cli/diffSummary";
import { messagesFromTurns } from "@/app/services/cli/threadMessages";
import { readThread } from "@/app/services/cli/threads";
import { buildTimelineFromTurns } from "@/app/services/cli/timeline";
import { mockThreadDetail } from "@/app/state/mockData";
import {
  loadCachedThreadDetail,
  storeCachedThreadDetail,
} from "@/app/state/threadCache";
import { getThreadMetadata } from "@/app/state/threadMetadata";
import type { ThreadDetail, ThreadMessage } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { formatRelativeTimeFromSeconds } from "@/app/utils/time";

export function useThreadDetail(threadId: string | undefined) {
  const isDesktop = isTauri();
  const query = useQuery({
    queryKey: ["threads", "read", threadId],
    queryFn: () => readThread(threadId ?? "", true),
    enabled: isDesktop && Boolean(threadId),
    refetchOnWindowFocus: isDesktop,
    refetchInterval: isDesktop && threadId ? 10000 : false,
    refetchIntervalInBackground: false,
  });
  const fallbackMessages = useMemo<ThreadMessage[]>(
    () => [
      {
        id: "mock-user-1",
        role: "user",
        content: mockThreadDetail.title,
      },
      {
        id: "mock-assistant-1",
        role: "assistant",
        content:
          "Polished the UI with new launch-ready typography, metadata, and clearer guidance across the booth, prompt dialog, and archive so the experience feels intentional and production-ready.\n\nChanges:\n- Updated layout and text surfaces to match a stronger visual system.\n- Tightened global color and contrast rules for dark-mode readability.\n- Refined photo strip and prompt dialog flows for first-time users.\n- Added clearer callouts and labels in the timeline and controls.\n\nNext steps:\n1. Run a full browser pass to verify spacing and hierarchy.\n2. Add share/download actions if you want launch touches.",
        activities: [
          {
            id: "mock-activity-1",
            kind: "command",
            label: "git status -sb",
            status: "completed",
            durationMs: 18000,
          },
          {
            id: "mock-activity-2",
            kind: "command",
            label: "Explored 1 list",
            status: "completed",
            durationMs: 42000,
          },
        ],
        workedDurationMs: 96000,
      },
    ],
    [mockThreadDetail.title],
  );
  const remoteThread = useMemo(() => {
    if (!isDesktop || !threadId || !query.data) {
      return null;
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
  }, [isDesktop, query.data, threadId]);
  const remoteMessages = useMemo<ThreadMessage[]>(
    () => messagesFromTurns(query.data?.turns ?? []),
    [query.data?.turns],
  );
  const cachedDetail = useMemo(() => {
    if (!isDesktop || !threadId) {
      return null;
    }
    return loadCachedThreadDetail(threadId);
  }, [isDesktop, threadId]);

  useEffect(() => {
    if (!threadId || !remoteThread) {
      return;
    }
    storeCachedThreadDetail(threadId, {
      thread: remoteThread,
      messages: remoteMessages,
    });
  }, [remoteMessages, remoteThread, threadId]);

  const thread = useMemo(() => {
    if (!isDesktop || !threadId) {
      return mockThreadDetail;
    }
    if (remoteThread) {
      return remoteThread;
    }
    if (cachedDetail?.thread) {
      return cachedDetail.thread;
    }
    return undefined;
  }, [cachedDetail?.thread, isDesktop, remoteThread, threadId]);
  const messages = useMemo<ThreadMessage[]>(() => {
    if (!isDesktop || !threadId) {
      return fallbackMessages;
    }
    if (query.data) {
      return remoteMessages;
    }
    if (cachedDetail) {
      return cachedDetail.messages;
    }
    return [];
  }, [
    cachedDetail,
    fallbackMessages,
    isDesktop,
    query.data,
    remoteMessages,
    threadId,
  ]);

  if (!isDesktop || !threadId) {
    return { thread, messages, isLoading: false };
  }

  return { thread, messages, isLoading: query.isPending };
}
