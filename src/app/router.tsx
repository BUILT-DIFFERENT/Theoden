import { Navigate, RootRoute, Route, Router } from "@tanstack/react-router";

import { AppServerRouteBoundary } from "@/app/components/layout/AppServerRouteBoundary";
import { AppShell } from "@/app/components/layout/AppShell";
import {
  RouteErrorFallback,
  RoutePendingFallback,
} from "@/app/components/layout/RouteFallbacks";
import { AutomationsPage } from "@/app/routes/AutomationsPage";
import { NewThreadPage } from "@/app/routes/NewThreadPage";
import { SettingsPage } from "@/app/routes/SettingsPage";
import { SkillsPage } from "@/app/routes/SkillsPage";
import { ThreadPage } from "@/app/routes/ThreadPage";
import { defaultSettingsSection } from "@/app/state/settingsData";

const rootRoute = new RootRoute({
  component: AppShell,
});

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
