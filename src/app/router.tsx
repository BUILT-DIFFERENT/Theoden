/* eslint-disable react-refresh/only-export-components */
import {
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
import { DiffRoutePage } from "@/app/routes/DiffRoutePage";
import { FilePreviewPage } from "@/app/routes/FilePreviewPage";
import { InboxPage } from "@/app/routes/InboxPage";
import { LoginPage } from "@/app/routes/LoginPage";
import { NewThreadPage } from "@/app/routes/NewThreadPage";
import { PlanSummaryPage } from "@/app/routes/PlanSummaryPage";
import { RemoteTaskPage } from "@/app/routes/RemoteTaskPage";
import { SelectWorkspacePage } from "@/app/routes/SelectWorkspacePage";
import { SettingsPage } from "@/app/routes/SettingsPage";
import { SkillsPage } from "@/app/routes/SkillsPage";
import { ThreadPage } from "@/app/routes/ThreadPage";
import { TranscribePage } from "@/app/routes/TranscribePage";
import { WelcomePage } from "@/app/routes/WelcomePage";
import { WorktreeInitPage } from "@/app/routes/WorktreeInitPage";
import {
  defaultSettingsSection,
  settingsSections,
  type SettingsSectionId,
} from "@/app/state/settingsData";
import { useThreadUi } from "@/app/state/threadUi";

const rootRoute = new RootRoute({
  component: AppShell,
});

function RedirectToWelcomeRoute() {
  return <Navigate to="/welcome" replace />;
}

function RedirectToFilePreviewRoute() {
  return <Navigate to="/file-preview" replace />;
}

function RedirectToPlanSummaryRoute() {
  return <Navigate to="/plan-summary" replace />;
}

function RedirectToPromptsRoute() {
  return <Navigate to="/plan-summary" replace />;
}

function RedirectToInboxRoute() {
  return <Navigate to="/inbox" replace />;
}

function RedirectToLoginRoute() {
  return <Navigate to="/login" replace />;
}

function RedirectToSettingsRoute({ section }: { section: SettingsSectionId }) {
  return <Navigate to="/settings/$section" params={{ section }} replace />;
}

function normalizeSettingsSection(
  section: string | undefined,
): SettingsSectionId {
  if (!section) {
    return defaultSettingsSection;
  }
  return settingsSections.some((item) => item.id === section)
    ? (section as SettingsSectionId)
    : defaultSettingsSection;
}

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

function WorktreeInitPendingWorktreeAliasRoute() {
  const { pendingWorktreeId } = useParams({
    from: "/worktree-init-v2/$pendingWorktreeId",
  });
  return (
    <Navigate
      to="/worktree-init-v2/$pendingId"
      params={{ pendingId: pendingWorktreeId }}
      replace
    />
  );
}

function SettingsSectionWildcardAliasRoute() {
  const { section } = useParams({ from: "/settings/$section/*" });
  return (
    <Navigate
      to="/settings/$section"
      params={{ section: normalizeSettingsSection(section) }}
      replace
    />
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

const announcementRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/announcement",
  component: RedirectToWelcomeRoute,
});

const firstRunRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/first-run",
  component: RedirectToWelcomeRoute,
});

const filesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/files",
  component: RedirectToFilePreviewRoute,
});

const debugRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/debug",
  component: RedirectToPlanSummaryRoute,
});

const promptsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/prompts",
  component: RedirectToPromptsRoute,
});

const promptsColonRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/prompts:",
  component: RedirectToPromptsRoute,
});

const remoteConversationRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/remote/$taskId",
  component: () => (
    <AppServerRouteBoundary>
      <RemoteTaskPage />
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

const threadOverlayBaseRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/thread-overlay",
  component: () => <Navigate to="/" replace />,
});

const threadOverlayTrailingSlashRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/thread-overlay/",
  component: () => <Navigate to="/" replace />,
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

const settingsWildcardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/*",
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

const settingsSectionWildcardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/$section/*",
  component: SettingsSectionWildcardAliasRoute,
});

const settingsAgentAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/agent",
  component: () => (
    <Navigate to="/settings/$section" params={{ section: "general" }} replace />
  ),
});

const settingsDataControlsAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/data-controls",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: "data-controls" }}
      replace
    />
  ),
});

const settingsGitAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/git-settings",
  component: () => (
    <Navigate to="/settings/$section" params={{ section: "git" }} replace />
  ),
});

const settingsLocalEnvironmentsAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/local-environments",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: "environments" }}
      replace
    />
  ),
});

const settingsPersonalizationAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/personalization",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: "personalization" }}
      replace
    />
  ),
});

const settingsWorktreesAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/worktrees",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: "worktrees" }}
      replace
    />
  ),
});

const settingsMcpAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/mcp-settings",
  component: () => (
    <Navigate
      to="/settings/$section"
      params={{ section: "mcp-servers" }}
      replace
    />
  ),
});

const settingsSkillsAliasRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings/skills-settings",
  component: () => (
    <Navigate to="/settings/$section" params={{ section: "skills" }} replace />
  ),
});

const whamAccountCheckRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/accounts/check",
  component: RedirectToLoginRoute,
});

const whamEnvironmentsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/environments",
  component: () => <RedirectToSettingsRoute section="environments" />,
});

const whamTasksRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/tasks",
  component: RedirectToInboxRoute,
});

const whamTasksListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/tasks/list",
  component: RedirectToInboxRoute,
});

const whamUsageRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/usage",
  component: () => <RedirectToSettingsRoute section="usage-analytics" />,
});

const whamSnapshotsFinishUploadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/worktree_snapshots/finish_upload",
  component: () => <RedirectToSettingsRoute section="worktrees" />,
});

const whamSnapshotsUploadUrlRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/wham/worktree_snapshots/upload_url",
  component: () => <RedirectToSettingsRoute section="worktrees" />,
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

const diffRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/diff",
  component: () => (
    <AppServerRouteBoundary>
      <DiffRoutePage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const filePreviewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/file-preview",
  component: () => (
    <AppServerRouteBoundary>
      <FilePreviewPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const planSummaryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/plan-summary",
  component: () => (
    <AppServerRouteBoundary>
      <PlanSummaryPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const transcribeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/transcribe",
  component: () => (
    <AppServerRouteBoundary>
      <TranscribePage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const worktreeInitRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/worktree-init-v2/$pendingId",
  component: () => (
    <AppServerRouteBoundary>
      <WorktreeInitPage />
    </AppServerRouteBoundary>
  ),
  errorComponent: RouteErrorFallback,
  pendingComponent: RoutePendingFallback,
});

const worktreeInitPendingWorktreeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/worktree-init-v2/$pendingWorktreeId",
  component: WorktreeInitPendingWorktreeAliasRoute,
});

const routeTree = rootRoute.addChildren([
  newThreadRoute,
  threadRoute,
  announcementRoute,
  firstRunRoute,
  filesRoute,
  debugRoute,
  promptsRoute,
  promptsColonRoute,
  localConversationRoute,
  remoteConversationRoute,
  threadOverlayRoute,
  threadOverlayBaseRoute,
  threadOverlayTrailingSlashRoute,
  inboxRoute,
  loginRoute,
  welcomeRoute,
  selectWorkspaceRoute,
  automationsRoute,
  settingsRoute,
  settingsWildcardRoute,
  settingsSectionRoute,
  settingsSectionWildcardRoute,
  settingsAgentAliasRoute,
  settingsDataControlsAliasRoute,
  settingsGitAliasRoute,
  settingsLocalEnvironmentsAliasRoute,
  settingsPersonalizationAliasRoute,
  settingsWorktreesAliasRoute,
  settingsMcpAliasRoute,
  settingsSkillsAliasRoute,
  whamAccountCheckRoute,
  whamEnvironmentsRoute,
  whamTasksRoute,
  whamTasksListRoute,
  whamUsageRoute,
  whamSnapshotsFinishUploadRoute,
  whamSnapshotsUploadUrlRoute,
  skillsRoute,
  diffRoute,
  filePreviewRoute,
  planSummaryRoute,
  transcribeRoute,
  worktreeInitRoute,
  worktreeInitPendingWorktreeRoute,
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
