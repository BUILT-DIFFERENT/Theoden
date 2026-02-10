/* eslint-disable react-refresh/only-export-components */
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  RootRoute,
  Route,
  Router,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AppServerRouteBoundary } from "@/app/components/layout/AppServerRouteBoundary";
import { AppShell } from "@/app/components/layout/AppShell";
import {
  RouteErrorFallback,
  RoutePendingFallback,
} from "@/app/components/layout/RouteFallbacks";
import { AutomationsPage } from "@/app/routes/AutomationsPage";
import { InboxPage } from "@/app/routes/InboxPage";
import { LoginPage } from "@/app/routes/LoginPage";
import { NewThreadPage } from "@/app/routes/NewThreadPage";
import { SelectWorkspacePage } from "@/app/routes/SelectWorkspacePage";
import { SettingsPage } from "@/app/routes/SettingsPage";
import { SkillsPage } from "@/app/routes/SkillsPage";
import { ThreadPage } from "@/app/routes/ThreadPage";
import { WelcomePage } from "@/app/routes/WelcomePage";
import { readThread } from "@/app/services/cli/threads";
import { defaultSettingsSection } from "@/app/state/settingsData";
import { useThreadUi } from "@/app/state/threadUi";
import { isTauri } from "@/app/utils/tauri";

const rootRoute = new RootRoute({
  component: AppShell,
});

function LocalConversationAliasRoute() {
  const { conversationId } = useParams({ from: "/local/$conversationId" });
  return (
    <Navigate to="/t/$threadId" params={{ threadId: conversationId }} replace />
  );
}

function ThreadOverlayAliasRoute() {
  const navigate = useNavigate();
  const { conversationId } = useParams({
    from: "/thread-overlay/$conversationId",
  });
  const { setReviewOpen } = useThreadUi();

  useEffect(() => {
    setReviewOpen(true);
    void navigate({
      to: "/t/$threadId",
      params: { threadId: conversationId },
      replace: true,
    });
  }, [conversationId, navigate, setReviewOpen]);

  return (
    <section className="surface-panel p-4 text-sm text-ink-300">
      Opening thread overlay…
    </section>
  );
}

function RemoteConversationAliasRoute() {
  const navigate = useNavigate();
  const { conversationId } = useParams({ from: "/remote/$conversationId" });
  const desktop = isTauri();
  const threadQuery = useQuery({
    queryKey: ["threads", "read", "remote-alias", conversationId],
    queryFn: () => readThread(conversationId, false),
    retry: false,
    enabled: desktop,
  });

  useEffect(() => {
    const threadId = threadQuery.data?.id;
    if (!threadId) {
      return;
    }
    void navigate({
      to: "/t/$threadId",
      params: { threadId },
      replace: true,
    });
  }, [navigate, threadQuery.data?.id]);

  if (threadQuery.isPending) {
    return (
      <section className="surface-panel p-4 text-sm text-ink-300">
        Resolving remote conversation…
      </section>
    );
  }

  if (threadQuery.data?.id) {
    return null;
  }

  return (
    <section className="surface-panel max-w-2xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
        Remote conversation
      </p>
      <h1 className="mt-2 font-display text-2xl text-ink-50">
        Task not yet linked
      </h1>
      <p className="mt-2 text-sm text-ink-300">
        Conversation <span className="font-mono">{conversationId}</span> is not
        linked to a local thread yet.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          to="/inbox"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Open inbox
        </Link>
        <Link
          to="/automations"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Open automations
        </Link>
      </div>
    </section>
  );
}

const threadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/t/$threadId",
  component: () => (
    <AppServerRouteBoundary>
      <ThreadPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const newThreadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <AppServerRouteBoundary>
      <NewThreadPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const automationsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/automations",
  component: () => (
    <AppServerRouteBoundary>
      <AutomationsPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const inboxRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/inbox",
  component: () => (
    <AppServerRouteBoundary>
      <InboxPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => (
    <AppServerRouteBoundary>
      <LoginPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const welcomeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  component: () => (
    <AppServerRouteBoundary>
      <WelcomePage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const selectWorkspaceRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/select-workspace",
  component: () => (
    <AppServerRouteBoundary>
      <SelectWorkspacePage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const localConversationRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/local/$conversationId",
  component: LocalConversationAliasRoute,
});

const remoteConversationRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/remote/$conversationId",
  component: () => (
    <AppServerRouteBoundary>
      <RemoteConversationAliasRoute />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const threadOverlayRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/thread-overlay/$conversationId",
  component: ThreadOverlayAliasRoute,
});

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: defaultSettingsSection }}
      replace
    />
  ),
});

const settingsSectionRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/$section",
  component: () => (
    <AppServerRouteBoundary>
      <SettingsPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const skillsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: () => (
    <AppServerRouteBoundary>
      <SkillsPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const routeTree = rootRoute.addChildren([
  newThreadRoute,
  threadRoute,
  localConversationRoute,
  remoteConversationRoute,
  threadOverlayRoute,
  inboxRoute,
  loginRoute,
  welcomeRoute,
  selectWorkspaceRoute,
  automationsRoute,
  settingsRoute,
  settingsSectionRoute,
  skillsRoute,
]);

export const router = new Router({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
