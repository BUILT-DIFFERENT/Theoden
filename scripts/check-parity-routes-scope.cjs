const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const scopePath = path.join(root, "docs/custom/parity-scope-v2.md");
const baselinePath = path.join(
  root,
  "third_party/CodexDesktop-Rebuild/docs/parity/routes.json",
);
const routerPath = path.join(root, "src/app/router.tsx");

function normalizeRoute(route) {
  let next = route.trim();
  next = next.replace(/\$[A-Za-z0-9_]+/g, ":param");
  next = next.replace(/:[A-Za-z0-9_]+/g, ":param");
  next = next.replace(/\/+/g, "/");
  if (next.length > 1 && next.endsWith("/")) {
    next = next.slice(0, -1);
  }
  return next;
}

function readIncludedRoutes(markdown) {
  const match = markdown.match(
    /## Included Route Scope([\s\S]*?)## Excluded Route Scope/m,
  );
  if (!match) {
    throw new Error(
      "Unable to parse included routes from docs/custom/parity-scope-v2.md.",
    );
  }
  return Array.from(match[1].matchAll(/- `([^`]+)`/g), (item) => item[1]);
}

function hasRoute(routeSet, expectedRoute) {
  if (expectedRoute.endsWith("/*")) {
    const prefix = normalizeRoute(expectedRoute.slice(0, -2));
    for (const route of routeSet) {
      if (route === prefix || route.startsWith(`${prefix}/`)) {
        return true;
      }
    }
    return false;
  }
  return routeSet.has(normalizeRoute(expectedRoute));
}

const scopeMarkdown = fs.readFileSync(scopePath, "utf8");
const includedRoutes = readIncludedRoutes(scopeMarkdown);

const baselinePayload = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const baselineRoutes = new Set(
  (baselinePayload.routes ?? []).map((route) => normalizeRoute(route)),
);

const routerSource = fs.readFileSync(routerPath, "utf8");
const appRoutes = new Set(
  Array.from(routerSource.matchAll(/path:\s*"([^"]+)"/g), (match) =>
    normalizeRoute(match[1]),
  ),
);

const missingFromBaseline = includedRoutes.filter(
  (route) => !hasRoute(baselineRoutes, route),
);
const missingFromRouter = includedRoutes.filter((route) => !hasRoute(appRoutes, route));

if (missingFromRouter.length) {
  console.error("Route scope parity check failed.");
  if (missingFromRouter.length) {
    console.error("Missing from app router:");
    missingFromRouter.forEach((route) => console.error(`- ${route}`));
  }
  process.exit(1);
}

if (missingFromBaseline.length) {
  console.warn(
    "Route scope warning: some scoped routes are not explicit in baseline routes.json (expected for aliases/shell roots).",
  );
  missingFromBaseline.forEach((route) => console.warn(`- ${route}`));
}

console.log(
  `Route scope parity check passed (${includedRoutes.length} scoped routes).`,
);
