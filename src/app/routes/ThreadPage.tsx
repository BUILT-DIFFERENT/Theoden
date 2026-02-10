import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadMessages } from "@/app/components/threads/ThreadMessages";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
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
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceUi();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessage[]>(
    [],
  );
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#121416]">
      <div
        ref={messagesContainerRef}
        className="codex-scrollbar min-h-0 flex-1 overflow-auto px-5 py-4"
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
                className="rounded-md border border-white/10 px-3 py-1 text-xs hover:border-white/25"
                onClick={handleLoadOlderMessages}
              >
                Load {Math.min(MESSAGE_WINDOW_SIZE, hiddenMessagesCount)} older
              </button>
            </div>
          </div>
        ) : null}
        <ThreadMessages messages={visibleMessages} />
      </div>
      <div className="border-t border-white/10 bg-[#14171a] px-5 py-3">
        <ApprovalsPanel threadId={threadId} />
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
