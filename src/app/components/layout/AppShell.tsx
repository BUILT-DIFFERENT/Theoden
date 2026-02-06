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
import {
  sendAppServerNotification,
  startAppServer,
} from "@/app/services/cli/appServer";
import { requestAppServer } from "@/app/services/cli/rpc";
import { useAppServerStream } from "@/app/services/cli/useAppServerStream";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useInteractionAudit } from "@/app/services/dev/useInteractionAudit";
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
import { defaultSettingsSection } from "@/app/state/settingsData";
import { ThreadUiProvider, type ThreadModal } from "@/app/state/threadUi";
import { WorkspaceUiProvider } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";

export function AppShell() {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const newThreadMatch = matchRoute({ to: "/" });
  const automationsMatch = matchRoute({ to: "/automations" });
  const skillsMatch = matchRoute({ to: "/skills" });
  const settingsMatch = matchRoute({ to: "/settings/$section" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
  const [reviewOpen, setReviewOpen] = useState(false);
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
  useAppServerStream();
  useInteractionAudit();

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
        await startAppServer({});
        await requestAppServer({
          method: "initialize",
          params: {
            clientInfo: {
              name: "codex_desktop",
              title: "Codex",
              version: "0.1.0",
            },
          },
        });
        await sendAppServerNotification("initialized");
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
          window.open(
            "https://developers.openai.com/codex/",
            "_blank",
            "noopener,noreferrer",
          );
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
          window.open(
            "https://developers.openai.com/codex/",
            "_blank",
            "noopener,noreferrer",
          );
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

  const topBarTitle = automationsMatch
    ? "Automations"
    : skillsMatch
      ? "Skills"
      : settingsMatch
        ? "Settings"
        : threadMatch
          ? "Thread"
          : "Codex";
  const topBarVariant = threadMatch
    ? "thread"
    : newThreadMatch
      ? "new-thread"
      : "page";
  const showReviewPanel = reviewOpen;

  return (
    <WorkspaceUiProvider>
      <EnvironmentUiProvider>
        <AppServerHealthProvider value={appServerHealth}>
          <ThreadUiProvider value={threadUi}>
            <div className="flex min-h-screen flex-col text-ink-50">
              {isDesktop ? (
                <WindowTitlebar onCommand={handleMenuCommand} />
              ) : null}
              <div className="flex min-h-0 flex-1">
                <AppSidebar />
                <main className="flex min-h-0 flex-1 flex-col">
                  <ThreadTopBar
                    variant={topBarVariant}
                    title={topBarTitle}
                    thread={threadMatch ? thread : undefined}
                    isNewThread={Boolean(newThreadMatch)}
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
        </AppServerHealthProvider>
      </EnvironmentUiProvider>
    </WorkspaceUiProvider>
  );
}
