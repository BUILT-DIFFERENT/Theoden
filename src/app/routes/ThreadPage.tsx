import { useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadMessages } from "@/app/components/threads/ThreadMessages";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadUi } from "@/app/state/threadUi";
import type { ThreadMessage } from "@/app/types";

export function ThreadPage() {
  const { threadId } = useParams({ from: "/t/$threadId" });
  const { thread, messages } = useThreadDetail(threadId);
  const { setReviewOpen } = useThreadUi();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessage[]>(
    [],
  );
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

  useEffect(() => {
    setOptimisticMessages([]);
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

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-auto"
        onScroll={handleMessagesScroll}
      >
        <ThreadMessages messages={conversationMessages} />
      </div>
      <div className="sticky bottom-4 z-10 space-y-3">
        {hasChanges ? (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-ink-900/80 px-4 py-3 text-xs text-ink-200 shadow-card">
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
