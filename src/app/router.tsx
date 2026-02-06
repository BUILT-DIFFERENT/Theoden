import { RootRoute, Route, Router } from "@tanstack/react-router";

import { AppShell } from "@/app/components/layout/AppShell";
import { AutomationsPage } from "@/app/routes/AutomationsPage";
import { ControlRoomPage } from "@/app/routes/ControlRoomPage";
import { NewThreadPage } from "@/app/routes/NewThreadPage";
import { SettingsPage } from "@/app/routes/SettingsPage";
import { SkillsPage } from "@/app/routes/SkillsPage";
import { ThreadPage } from "@/app/routes/ThreadPage";
import { ThreadsPage } from "@/app/routes/ThreadsPage";

const rootRoute = new RootRoute({
  component: AppShell,
});

const controlRoomRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/control-room",
  component: ControlRoomPage,
});

const threadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/threads/$threadId",
  component: ThreadPage,
});

const newThreadRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NewThreadPage,
});

const threadListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/threads",
  component: ThreadsPage,
});

const automationsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/automations",
  component: AutomationsPage,
});

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const skillsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: SkillsPage,
});

const routeTree = rootRoute.addChildren([
  controlRoomRoute,
  threadListRoute,
  newThreadRoute,
  threadRoute,
  automationsRoute,
  settingsRoute,
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
