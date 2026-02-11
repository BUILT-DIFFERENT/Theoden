#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const action = (process.argv[2] || "dev").trim().toLowerCase();

if (!["dev", "build"].includes(action)) {
  console.error(
    `[run-desktop] unsupported action "${action}". Expected "dev" or "build".`,
  );
  process.exit(1);
}
console.log(`[run-desktop] action=${action} mode=rewrite`);

const result = spawnSync(`pnpm tauri ${action}`, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(`[run-desktop] ${result.error.message}`);
  process.exit(1);
}
