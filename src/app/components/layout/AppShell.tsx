import { Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { BottomBar } from "@/app/components/layout/BottomBar";
import { TerminalDrawer } from "@/app/components/layout/TerminalDrawer";
import { WindowTitlebar } from "@/app/components/layout/WindowTitlebar";
import { AppSidebar } from "@/app/components/sidebar/AppSidebar";
import { ThreadTopBar } from "@/app/components/threads/ThreadTopBar";
import { WorkspaceModal } from "@/app/components/workspaces/WorkspaceModal";
import { startAppServer } from "@/app/services/cli/appServer";
import { useAppServerStream } from "@/app/services/cli/useAppServerStream";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useInteractionAudit } from "@/app/services/dev/useInteractionAudit";
import { openExternalUrl } from "@/app/services/host/external";
import { subscribeHostDeeplinks } from "@/app/services/host/runtime";
import {
  executeMenuCommand,
  type MenuCommandId,
  resolveMenuShortcut,
} from "@/app/services/menu/menuCommands";
import {
  AppServerHealthProvider,
  type AppServerHealthStatus,
} from "@/app/state/appServerHealth";
import { useAppUi } from "@/app/state/appUi";
import { EnvironmentUiProvider } from "@/app/state/environmentUi";
import {
  defaultSettingsSection,
  settingsSections,
} from "@/app/state/settingsData";
import { ThreadUiProvider, type ThreadModal } from "@/app/state/threadUi";
import { WorkspaceUiProvider } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";

export function AppShell() {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const newThreadMatch = matchRoute({ to: "/" });
  const automationsMatch = matchRoute({ to: "/automations" });
  const inboxMatch = matchRoute({ to: "/inbox" });
  const loginMatch = matchRoute({ to: "/login" });
  const welcomeMatch = matchRoute({ to: "/welcome" });
  const selectWorkspaceMatch = matchRoute({ to: "/select-workspace" });
  const skillsMatch = matchRoute({ to: "/skills" });
  const diffMatch = matchRoute({ to: "/diff" });
  const filePreviewMatch = matchRoute({ to: "/file-preview" });
  const planSummaryMatch = matchRoute({ to: "/plan-summary" });
  const transcribeMatch = matchRoute({ to: "/transcribe" });
  const remoteTaskMatch = matchRoute({ to: "/remote/$taskId" });
  const worktreeInitMatch = matchRoute({ to: "/worktree-init-v2/$pendingId" });
  const settingsMatch = matchRoute({ to: "/settings/$section" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
  const [reviewOpen, setReviewOpen] = useState(Boolean(threadId));
  const [activeModal, setActiveModal] = useState<ThreadModal>(null);
  const [appServerStatus, setAppServerStatus] = useState<AppServerHealthStatus>(
    () => (isTauri() ? "booting" : "ready"),
  );
  const [appServerError, setAppServerError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { isTerminalOpen, toggleTerminal, setComposerDraft } = useAppUi();
  const isDesktop = isTauri();
  const bootstrapInFlightRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reviewInitThreadRef = useRef<string | null>(threadId ?? null);
  useAppServerStream();
  useInteractionAudit();

  useEffect(() => {
    if (!threadId) {
      reviewInitThreadRef.current = null;
      return;
    }
    if (reviewInitThreadRef.current === threadId) {
      return;
    }
    reviewInitThreadRef.current = threadId;
    setReviewOpen(true);
  }, [threadId]);

  const bootstrapAppServer = useCallback(
    async (status: AppServerHealthStatus) => {
      if (!isDesktop) {
        return;
      }
      if (bootstrapInFlightRef.current) {
        return;
      }
      bootstrapInFlightRef.current = true;
      setAppServerStatus(status);
      try {
        await startAppServer({
          clientInfo: {
            name: "codex_desktop",
            title: "Codex",
            version: "0.1.0",
          },
        });
        reconnectAttemptRef.current = 0;
        setReconnectAttempts(0);
        setAppServerError(null);
        setAppServerStatus("ready");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "App-server bootstrap failed.";
        setAppServerError(message);
        setAppServerStatus("error");
      } finally {
        bootstrapInFlightRef.current = false;
      }
    },
    [isDesktop],
  );

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (!isDesktop) {
        return;
      }
      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;
      setReconnectAttempts(attempt);
      setAppServerError(reason);
      setAppServerStatus("reconnecting");
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const delayMs = Math.min(1000 * 2 ** Math.max(attempt - 1, 0), 10000);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void bootstrapAppServer("reconnecting");
      }, delayMs);
    },
    [bootstrapAppServer, isDesktop],
  );

  const restartAppServer = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setReconnectAttempts(0);
    setAppServerError(null);
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    void bootstrapAppServer("booting");
  }, [bootstrapAppServer]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    void bootstrapAppServer("booting");
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [bootstrapAppServer, isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    let active = true;
    let unlistenExit: (() => void) | undefined;
    let unlistenTimeout: (() => void) | undefined;

    const registerListeners = async () => {
      const detachExit = await listen<{
        code?: number | null;
        success?: boolean;
        error?: string;
      }>("app-server-exit", (event) => {
        const payload = event.payload ?? {};
        const reason = payload.error
          ? `app-server exited: ${payload.error}`
          : payload.code === undefined || payload.code === null
            ? "app-server exited unexpectedly."
            : `app-server exited with code ${payload.code}.`;
        scheduleReconnect(reason);
      });

      if (active) {
        unlistenExit = detachExit;
      } else {
        detachExit();
      }

      const detachTimeout = await listen<{ id?: string; method?: string }>(
        "app-server-timeout",
        (event) => {
          const payload = event.payload ?? {};
          const method = payload.method ?? "unknown";
          scheduleReconnect(`app-server request timed out (${method}).`);
        },
      );

      if (active) {
        unlistenTimeout = detachTimeout;
      } else {
        detachTimeout();
      }
    };

    void registerListeners();

    return () => {
      active = false;
      unlistenExit?.();
      unlistenTimeout?.();
    };
  }, [isDesktop, scheduleReconnect]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    let unlisten: (() => void) | null = null;
    void subscribeHostDeeplinks((payload) => {
      if (payload.route === "/settings" && payload.section) {
        const section = settingsSections.some(
          (item) => item.id === payload.section,
        )
          ? payload.section
          : defaultSettingsSection;
        void navigate({
          to: "/settings/$section",
          params: {
            section: section as (typeof settingsSections)[number]["id"],
          },
        });
        return;
      }
      if (payload.route === "/skills") {
        void navigate({ to: "/skills" });
        return;
      }
      if (payload.route === "/automations") {
        void navigate({ to: "/automations" });
        return;
      }
      if (payload.route === "/") {
        void navigate({ to: "/" });
        return;
      }
      if (payload.route === "/t" && payload.threadId) {
        void navigate({
          to: "/t/$threadId",
          params: { threadId: payload.threadId },
        });
        return;
      }
      if (payload.route === "/remote" && payload.taskId) {
        void navigate({
          to: "/remote/$taskId",
          params: { taskId: payload.taskId },
        });
        return;
      }
      if (payload.route === "/worktree-init-v2" && payload.pendingId) {
        void navigate({
          to: "/worktree-init-v2/$pendingId",
          params: { pendingId: payload.pendingId },
        });
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [isDesktop, navigate]);

  const handleMenuCommand = useCallback(
    async (command: MenuCommandId) => {
      const closeCurrentWindow = async () => {
        if (!isDesktop) {
          return;
        }
        await getCurrentWindow().close();
      };

      await executeMenuCommand(command, {
        navigateHome: () => {
          setComposerDraft("");
          setReviewOpen(false);
          setActiveModal(null);
          void navigate({ to: "/" });
        },
        navigateAutomations: () => {
          void navigate({ to: "/automations" });
        },
        navigateSkills: () => {
          void navigate({ to: "/skills" });
        },
        navigateSettings: () => {
          void navigate({
            to: "/settings/$section",
            params: { section: defaultSettingsSection },
          });
        },
        reloadUi: () => {
          window.location.reload();
        },
        toggleTerminal,
        toggleReviewPanel: () => {
          setReviewOpen((open) => !open);
        },
        openDocs: () => {
          void openExternalUrl("https://developers.openai.com/codex/");
        },
        closeWindow: closeCurrentWindow,
        quitApp: closeCurrentWindow,
        minimizeWindow: async () => {
          if (!isDesktop) {
            return;
          }
          await getCurrentWindow().minimize();
        },
        toggleMaximizeWindow: async () => {
          if (!isDesktop) {
            return;
          }
          await getCurrentWindow().toggleMaximize();
        },
        performEditAction: (action) => {
          if (typeof document === "undefined" || !document.execCommand) {
            return;
          }
          document.execCommand(action);
        },
        showAbout: () => {
          void openExternalUrl("https://developers.openai.com/codex/");
        },
      });
    },
    [isDesktop, navigate, setComposerDraft, toggleTerminal],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = resolveMenuShortcut(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      void handleMenuCommand(command);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMenuCommand]);

  const threadUi = useMemo(
    () => ({
      reviewOpen,
      setReviewOpen,
      activeModal,
      setActiveModal,
    }),
    [activeModal, reviewOpen],
  );
  const appServerHealth = useMemo(
    () => ({
      status: appServerStatus,
      lastError: appServerError,
      reconnectAttempts,
      restart: restartAppServer,
    }),
    [appServerError, appServerStatus, reconnectAttempts, restartAppServer],
  );

  const topBarTitle = (() => {
    if (automationsMatch) return "Automations";
    if (inboxMatch) return "Inbox";
    if (loginMatch) return "Login";
    if (welcomeMatch) return "Welcome";
    if (selectWorkspaceMatch) return "Select workspace";
    if (skillsMatch) return "Skills";
    if (diffMatch) return "Diff";
    if (filePreviewMatch) return "File preview";
    if (planSummaryMatch) return "Plan summary";
    if (transcribeMatch) return "Transcribe";
    if (remoteTaskMatch) return "Remote task";
    if (worktreeInitMatch) return "Worktree init";
    if (settingsMatch) return "Settings";
    if (threadMatch) return thread?.title ?? "Thread";
    return "Codex";
  })();
  const topBarVariant = threadMatch
    ? "thread"
    : newThreadMatch
      ? "new-thread"
      : "page";
  const showReviewPanel = reviewOpen;
  const showBottomBar = !(threadMatch || newThreadMatch);

  return (
    <WorkspaceUiProvider>
      <EnvironmentUiProvider>
        <AppServerHealthProvider value={appServerHealth}>
          <ThreadUiProvider value={threadUi}>
            <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,#1a1d1d_0%,#131517_12%,#101214_100%)] text-ink-50">
              <div className="flex h-full flex-col overflow-hidden">
                {isDesktop ? (
                  <WindowTitlebar onCommand={handleMenuCommand} />
                ) : null}
                <div className="flex min-h-0 flex-1 overflow-hidden bg-[#121417]">
                  <AppSidebar />
                  <main className="flex min-h-0 flex-1 flex-col bg-[#131518]">
                    <ThreadTopBar
                      variant={topBarVariant}
                      title={topBarTitle}
                      thread={threadMatch ? thread : undefined}
                      isNewThread={Boolean(newThreadMatch)}
                    />
                    <div
                      className={
                        showReviewPanel
                          ? "grid min-h-0 flex-1 grid-cols-1 lg:[grid-template-columns:minmax(0,1fr)_minmax(470px,40%)]"
                          : "min-h-0 flex-1"
                      }
                    >
                      <section className="h-full min-h-0 min-w-0 bg-[#121416]">
                        <Outlet />
                      </section>
                      {showReviewPanel ? (
                        <aside className="hidden min-h-0 border-l border-white/10 bg-[#14171b] lg:block">
                          <DiffPanel
                            thread={threadMatch ? thread : undefined}
                          />
                        </aside>
                      ) : null}
                    </div>
                    <TerminalDrawer isOpen={isTerminalOpen} />
                    {showBottomBar ? <BottomBar /> : null}
                  </main>
                </div>
              </div>
            </div>
            <WorkspaceModal />
          </ThreadUiProvider>
        </AppServerHealthProvider>
      </EnvironmentUiProvider>
    </WorkspaceUiProvider>
  );
}
