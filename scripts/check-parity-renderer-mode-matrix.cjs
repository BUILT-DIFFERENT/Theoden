#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const runtimeManifestPath = path.join(
  root,
  "out",
  "desktop-runtime",
  "renderer-manifest.json",
);

const modes = ["compat", "rewrite"];
const commands = [
  "pnpm prepare:desktop-runtime",
  "pnpm parity:test:routes",
  "pnpm parity:test:thread-slice",
  "pnpm parity:test:review-git-terminal",
  "pnpm parity:test:automations-cloud-settings",
  "pnpm parity:test:cloud-sidebar-settings",
];

function run(command, mode) {
  const env = {
    ...process.env,
    CODEX_DESKTOP_RENDERER_MODE: mode,
    VITE_DESKTOP_RENDERER_MODE: mode,
  };
  const result = spawnSync(command, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.error) {
    throw result.error;
  }
}

function assertManifestMode(expectedMode) {
  if (!fs.existsSync(runtimeManifestPath)) {
    throw new Error(
      `missing renderer manifest after prepare: ${runtimeManifestPath}`,
    );
  }
  const manifest = JSON.parse(fs.readFileSync(runtimeManifestPath, "utf8"));
  if (manifest.mode !== expectedMode) {
    throw new Error(
      `renderer manifest mode mismatch: expected "${expectedMode}", received "${manifest.mode}"`,
    );
  }
}

for (const mode of modes) {
  console.log(`[renderer-mode-matrix] starting mode=${mode}`);
  for (const command of commands) {
    console.log(`[renderer-mode-matrix] mode=${mode} running: ${command}`);
    run(command, mode);
    if (command === "pnpm prepare:desktop-runtime") {
      assertManifestMode(mode);
    }
  }
}

console.log("[renderer-mode-matrix] parity mode matrix passed.");
