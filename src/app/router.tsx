import { Navigate, RootRoute, Route, Router } from "@tanstack/react-router";

import { AppShell } from "@/app/components/layout/AppShell";
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
  component: ThreadPage,
});

const newThreadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NewThreadPage,
});

const automationsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/automations",
  component: AutomationsPage,
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
  component: SettingsPage,
});

const skillsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: SkillsPage,
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
