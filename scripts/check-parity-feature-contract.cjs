const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const mainRsPath = path.join(root, "src-tauri/src/main.rs");
const hostRuntimePath = path.join(root, "src/app/services/host/runtime.ts");

const mainRs = fs.readFileSync(mainRsPath, "utf8");
const hostRuntimeSource = fs.existsSync(hostRuntimePath)
  ? fs.readFileSync(hostRuntimePath, "utf8")
  : "";

const requiredHostCommands = [
  "host_dispatch_deeplink",
  "host_get_update_state",
  "host_check_updates",
  "bridge_get_build_flavor",
];

const requiredHostEvents = ["host-deeplink", "host-update-state"];

const missingCommands = requiredHostCommands.filter(
  (symbol) => !mainRs.includes(symbol),
);
const missingEvents = requiredHostEvents.filter(
  (symbol) => !mainRs.includes(symbol),
);

const requiredWrappers = [
  "dispatchHostDeeplink",
  "getHostUpdateState",
  "checkForHostUpdates",
  "subscribeHostDeeplinks",
  "subscribeHostUpdateState",
  "getBridgeBuildFlavor",
];

const missingWrappers = requiredWrappers.filter(
  (symbol) => !hostRuntimeSource.includes(symbol),
);

if (
  missingCommands.length ||
  missingEvents.length ||
  missingWrappers.length
) {
  console.error("Feature-contract parity check failed.");
  if (missingCommands.length) {
    console.error("Missing host commands:");
    missingCommands.forEach((symbol) => console.error(`- ${symbol}`));
  }
  if (missingEvents.length) {
    console.error("Missing emitted host events:");
    missingEvents.forEach((symbol) => console.error(`- ${symbol}`));
  }
  if (missingWrappers.length) {
    console.error("Missing host runtime wrappers:");
    missingWrappers.forEach((symbol) => console.error(`- ${symbol}`));
  }
  process.exit(1);
}

console.log(
  `Feature-contract parity check passed (${requiredHostCommands.length} commands).`,
);
