import { useParams } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RunTimeline } from "@/app/components/runs/RunTimeline";
import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadMessages } from "@/app/components/threads/ThreadMessages";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadMessage } from "@/app/types";
import {
  isLikelyWorkspacePath,
  normalizeWorkspacePath,
} from "@/app/utils/workspace";

const MESSAGE_WINDOW_SIZE = 120;

export function ThreadPage() {
  const { threadId } = useParams({ from: "/t/$threadId" });
  const { thread, messages } = useThreadDetail(threadId);
  const { setReviewOpen } = useThreadUi();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceUi();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessage[]>(
    [],
  );
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);
  const detail = thread ?? mockThreadDetail;
  const liveDiffText = useThreadDiffText(threadId, detail.diffText ?? "");
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const diffStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detail.diffSummary.additions,
        deletions: detail.diffSummary.deletions,
      };
  const summary = {
    ...detail.diffSummary,
    additions: diffStats.additions,
    deletions: diffStats.deletions,
  };
  const hasChanges = summary.filesChanged > 0;
  const conversationMessages = useMemo(
    () => [...messages, ...optimisticMessages],
    [messages, optimisticMessages],
  );
  const visibleMessages = useMemo(
    () => conversationMessages.slice(visibleStartIndex),
    [conversationMessages, visibleStartIndex],
  );
  const hiddenMessagesCount = visibleStartIndex;

  useEffect(() => {
    setOptimisticMessages([]);
    setVisibleStartIndex(0);
    setStickToBottom(true);
  }, [threadId]);

  useEffect(() => {
    setOptimisticMessages((current) =>
      current.filter(
        (optimistic) =>
          !messages.some(
            (message) =>
              message.role === optimistic.role &&
              message.content === optimistic.content,
          ),
      ),
    );
  }, [messages]);

  useEffect(() => {
    if (!thread?.subtitle) {
      return;
    }
    if (!isLikelyWorkspacePath(thread.subtitle)) {
      return;
    }
    if (
      selectedWorkspace &&
      normalizeWorkspacePath(selectedWorkspace).toLowerCase() ===
        normalizeWorkspacePath(thread.subtitle).toLowerCase()
    ) {
      return;
    }
    setSelectedWorkspace(thread.subtitle);
  }, [selectedWorkspace, setSelectedWorkspace, thread?.subtitle]);

  useEffect(() => {
    setVisibleStartIndex((current) => {
      const maxStart = Math.max(0, conversationMessages.length - 1);
      if (stickToBottom) {
        return Math.max(0, conversationMessages.length - MESSAGE_WINDOW_SIZE);
      }
      return Math.min(current, maxStart);
    });
  }, [conversationMessages.length, stickToBottom]);

  useEffect(() => {
    if (!stickToBottom) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversationMessages.length, stickToBottom]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setStickToBottom(distanceFromBottom <= 48);
  };

  const handleLoadOlderMessages = () => {
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setVisibleStartIndex((current) =>
      Math.max(0, current - MESSAGE_WINDOW_SIZE),
    );
    window.requestAnimationFrame(() => {
      const nextContainer = messagesContainerRef.current;
      if (!nextContainer) return;
      const nextHeight = nextContainer.scrollHeight;
      nextContainer.scrollTop += nextHeight - previousHeight;
    });
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div
        ref={messagesContainerRef}
        className="codex-scrollbar flex-1 overflow-auto"
        onScroll={handleMessagesScroll}
      >
        {hiddenMessagesCount > 0 ? (
          <div className="surface-card mb-3 px-4 py-3 text-xs text-ink-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Showing {visibleMessages.length} of{" "}
                {conversationMessages.length} messages
              </span>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
                onClick={handleLoadOlderMessages}
              >
                Load {Math.min(MESSAGE_WINDOW_SIZE, hiddenMessagesCount)} older
              </button>
            </div>
          </div>
        ) : null}
        <ThreadMessages messages={visibleMessages} />
      </div>
      <div className="sticky bottom-4 z-10 space-y-3">
        <ApprovalsPanel threadId={threadId} />
        <div className="surface-panel px-4 py-3">
          <button
            className="flex w-full items-center justify-between text-xs text-ink-200"
            onClick={() => setTimelineOpen((open) => !open)}
          >
            <span>Run timeline</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${
                timelineOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {timelineOpen ? (
            <div className="mt-3 max-h-72 overflow-auto">
              <RunTimeline />
            </div>
          ) : null}
        </div>
        {hasChanges ? (
          <div className="surface-panel flex items-center justify-between px-4 py-3 text-xs text-ink-200">
            <span>
              {summary.filesChanged} file changed +{summary.additions} -
              {summary.deletions}
            </span>
            <button
              className="flex items-center gap-2 rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setReviewOpen(true)}
            >
              Review changes
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <ThreadComposer
          placeholder="Ask for follow-up changes"
          onSubmitted={(message) => {
            setOptimisticMessages((current) => [
              ...current,
              {
                id: `optimistic-${Date.now()}-${current.length}`,
                role: "user",
                content: message,
              },
            ]);
          }}
        />
      </div>
      <ThreadModals thread={thread} />
    </div>
  );
}
