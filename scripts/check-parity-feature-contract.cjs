const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const mainRsPath = path.join(root, "src-tauri/src/main.rs");
const bridgePath = path.join(root, "src/app/services/bridge/electronCompat.ts");
const hostRuntimePath = path.join(root, "src/app/services/host/runtime.ts");
const featureContractPath = path.join(
  root,
  "third_party/CodexDesktop-Rebuild/docs/parity/feature-contract.md",
);

const mainRs = fs.readFileSync(mainRsPath, "utf8");
const bridgeSource = fs.existsSync(bridgePath)
  ? fs.readFileSync(bridgePath, "utf8")
  : "";
const hostRuntimeSource = fs.existsSync(hostRuntimePath)
  ? fs.readFileSync(hostRuntimePath, "utf8")
  : "";
const featureContract = fs.readFileSync(featureContractPath, "utf8");

const requiredHostCommands = [
  "host_dispatch_deeplink",
  "host_get_renderer_mode",
  "host_get_update_state",
  "host_check_updates",
  "bridge_message_from_view",
  "bridge_show_context_menu",
  "bridge_get_build_flavor",
];

const requiredHostEvents = [
  "host-deeplink",
  "host-update-state",
  "codex-desktop-message-for-view",
];

const requiredBridgeChannels = [
  "codex_desktop:message-from-view",
  "codex_desktop:message-for-view",
  "codex_desktop:show-context-menu",
  "codex_desktop:get-build-flavor",
];

const missingCommands = requiredHostCommands.filter(
  (symbol) => !mainRs.includes(symbol),
);
const missingEvents = requiredHostEvents.filter(
  (symbol) => !mainRs.includes(symbol),
);
const missingChannelsInBridge = requiredBridgeChannels.filter(
  (symbol) => !bridgeSource.includes(symbol),
);
const missingChannelsInContract = requiredBridgeChannels.filter(
  (symbol) => !featureContract.includes(symbol),
);

const requiredWrappers = [
  "dispatchHostDeeplink",
  "getHostRendererMode",
  "getHostUpdateState",
  "checkForHostUpdates",
  "subscribeHostDeeplinks",
  "subscribeHostUpdateState",
  "sendBridgeMessageFromView",
  "showBridgeContextMenu",
  "getBridgeBuildFlavor",
];

const missingWrappers = requiredWrappers.filter(
  (symbol) => !hostRuntimeSource.includes(symbol),
);

if (
  missingCommands.length ||
  missingEvents.length ||
  missingChannelsInBridge.length ||
  missingChannelsInContract.length ||
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
  if (missingChannelsInBridge.length) {
    console.error("Missing bridge channels in frontend compatibility adapter:");
    missingChannelsInBridge.forEach((symbol) => console.error(`- ${symbol}`));
  }
  if (missingChannelsInContract.length) {
    console.error("Required channels missing from baseline feature contract:");
    missingChannelsInContract.forEach((symbol) => console.error(`- ${symbol}`));
  }
  if (missingWrappers.length) {
    console.error("Missing host runtime wrappers:");
    missingWrappers.forEach((symbol) => console.error(`- ${symbol}`));
  }
  process.exit(1);
}

console.log(
  `Feature-contract parity check passed (${requiredHostCommands.length} commands, ${requiredBridgeChannels.length} channels).`,
);
