import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { ControlRoomSidebar } from "@/app/components/control-room/ControlRoomSidebar";
import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";
import { ThreadMetaPanel } from "@/app/components/threads/ThreadMetaPanel";
import {
  sendAppServerNotification,
  sendAppServerRequest,
  startAppServer,
} from "@/app/services/cli/appServer";
import { useAppServerStream } from "@/app/services/cli/useAppServerStream";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { isTauri } from "@/app/utils/tauri";

export function AppShell() {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
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

  return (
    <div className="min-h-screen text-ink-50">
      <div className="flex min-h-screen">
        <ControlRoomSidebar />
        <main className="flex-1 border-x border-white/5">
          <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-300">
                Command Center
              </p>
              <h1 className="font-display text-2xl">
                Threads, runs, and outcomes
              </h1>
            </div>
            <nav className="flex items-center gap-3 text-sm text-ink-200">
              <Link
                to="/"
                className="rounded-full border border-white/10 px-3 py-1.5 hover:border-flare-300"
              >
                Control Room
              </Link>
              <Link
                to="/threads"
                className="rounded-full border border-white/10 px-3 py-1.5 hover:border-flare-300"
              >
                Threads
              </Link>
              <Link
                to="/skills"
                className="rounded-full border border-white/10 px-3 py-1.5 hover:border-flare-300"
              >
                Skills
              </Link>
              <Link
                to="/settings"
                className="rounded-full border border-white/10 px-3 py-1.5 hover:border-flare-300"
              >
                Settings
              </Link>
            </nav>
          </header>
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-h-[70vh]">
              <Outlet />
            </section>
            <aside className="hidden lg:block">
              <div className="space-y-6">
                <ApprovalsPanel threadId={threadId} />
                <ThreadMetaPanel thread={thread} />
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
