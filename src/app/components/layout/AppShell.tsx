import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ControlRoomSidebar } from "@/app/components/control-room/ControlRoomSidebar";
import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { BottomBar } from "@/app/components/layout/BottomBar";
import { ThreadTopBar } from "@/app/components/threads/ThreadTopBar";
import { WorkspaceModal } from "@/app/components/workspaces/WorkspaceModal";
import {
  sendAppServerNotification,
  sendAppServerRequest,
  startAppServer,
} from "@/app/services/cli/appServer";
import { useAppServerStream } from "@/app/services/cli/useAppServerStream";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { ThreadUiProvider, type ThreadModal } from "@/app/state/threadUi";
import { WorkspaceUiProvider } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";

export function AppShell() {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const newThreadMatch = matchRoute({ to: "/" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
  const showThreadHeader = Boolean(threadMatch || newThreadMatch);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ThreadModal>(null);
  useAppServerStream();

  useEffect(() => {
    if (!isTauri()) return;
    if (window.__THEODEN_APP_SERVER_STARTED__) return;
    window.__THEODEN_APP_SERVER_STARTED__ = true;

    const bootstrap = async () => {
      try {
        await startAppServer({});
        await sendAppServerRequest({
          id: Date.now(),
          method: "initialize",
          params: {
            clientInfo: {
              name: "theoden_desktop",
              title: "Theoden Desktop",
              version: "0.1.0",
            },
          },
        });
        await sendAppServerNotification("initialized");
      } catch (error) {
        console.warn("App-server bootstrap failed", error);
      }
    };

    void bootstrap();
  }, []);

  const threadUi = useMemo(
    () => ({
      reviewOpen,
      setReviewOpen,
      activeModal,
      setActiveModal,
    }),
    [activeModal, reviewOpen],
  );

  const showReviewPanel = showThreadHeader && reviewOpen;

  return (
    <WorkspaceUiProvider>
      <ThreadUiProvider value={threadUi}>
        <div className="min-h-screen text-ink-50">
          <div className="flex min-h-screen">
            <ControlRoomSidebar />
            <main className="flex min-h-screen flex-1 flex-col">
              {showThreadHeader ? (
                <ThreadTopBar
                  thread={thread}
                  isNewThread={Boolean(newThreadMatch)}
                />
              ) : null}
              <div
                className={
                  showReviewPanel
                    ? "grid flex-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px]"
                    : "flex-1 px-6 py-6"
                }
              >
                <section className="min-h-[70vh]">
                  <Outlet />
                </section>
                {showReviewPanel ? (
                  <aside className="hidden lg:block">
                    <DiffPanel thread={thread} />
                  </aside>
                ) : null}
              </div>
              <BottomBar />
            </main>
          </div>
        </div>
        <WorkspaceModal />
      </ThreadUiProvider>
    </WorkspaceUiProvider>
  );
}
