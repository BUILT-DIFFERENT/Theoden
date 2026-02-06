import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { BottomBar } from "@/app/components/layout/BottomBar";
import { TerminalDrawer } from "@/app/components/layout/TerminalDrawer";
import { AppSidebar } from "@/app/components/sidebar/AppSidebar";
import { ThreadTopBar } from "@/app/components/threads/ThreadTopBar";
import { WorkspaceModal } from "@/app/components/workspaces/WorkspaceModal";
import {
  sendAppServerNotification,
  sendAppServerRequest,
  startAppServer,
} from "@/app/services/cli/appServer";
import { useAppServerStream } from "@/app/services/cli/useAppServerStream";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useInteractionAudit } from "@/app/services/dev/useInteractionAudit";
import { useAppUi } from "@/app/state/appUi";
import { EnvironmentUiProvider } from "@/app/state/environmentUi";
import { ThreadUiProvider, type ThreadModal } from "@/app/state/threadUi";
import { WorkspaceUiProvider } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";

export function AppShell() {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const newThreadMatch = matchRoute({ to: "/" });
  const automationsMatch = matchRoute({ to: "/automations" });
  const skillsMatch = matchRoute({ to: "/skills" });
  const settingsMatch = matchRoute({ to: "/settings/$section" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ThreadModal>(null);
  const { isTerminalOpen, toggleTerminal } = useAppUi();
  useAppServerStream();
  useInteractionAudit();

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "j") return;
      event.preventDefault();
      toggleTerminal();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTerminal]);

  const threadUi = useMemo(
    () => ({
      reviewOpen,
      setReviewOpen,
      activeModal,
      setActiveModal,
    }),
    [activeModal, reviewOpen],
  );

  const topBarTitle = automationsMatch
    ? "Automations"
    : skillsMatch
      ? "Skills"
      : settingsMatch
        ? "Settings"
        : "Codex";
  const showReviewPanel = reviewOpen;

  return (
    <WorkspaceUiProvider>
      <EnvironmentUiProvider>
        <ThreadUiProvider value={threadUi}>
          <div className="min-h-screen text-ink-50">
            <div className="flex min-h-screen">
              <AppSidebar />
              <main className="flex min-h-screen flex-1 flex-col">
                <ThreadTopBar
                  title={topBarTitle}
                  thread={threadMatch ? thread : undefined}
                  isNewThread={Boolean(newThreadMatch)}
                  isTerminalOpen={isTerminalOpen}
                  onToggleTerminal={toggleTerminal}
                />
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
                      <DiffPanel thread={threadMatch ? thread : undefined} />
                    </aside>
                  ) : null}
                </div>
                <TerminalDrawer isOpen={isTerminalOpen} />
                <BottomBar />
              </main>
            </div>
          </div>
          <WorkspaceModal />
        </ThreadUiProvider>
      </EnvironmentUiProvider>
    </WorkspaceUiProvider>
  );
}
