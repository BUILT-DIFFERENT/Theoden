#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const compatSourceDir = path.join(root, "out", "electron-ui");
const rewriteSourceDir = path.join(root, "dist");
const runtimeOutputDir = path.join(root, "out", "desktop-runtime");

const requestedMode = (process.env.CODEX_DESKTOP_RENDERER_MODE || "compat")
  .trim()
  .toLowerCase();
const rendererMode = requestedMode === "rewrite" ? "rewrite" : "compat";

function run(command) {
  const result = spawnSync(command, {
    cwd: root,
    env: process.env,
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

function fail(message) {
  console.error(`[prepare-desktop-runtime] ${message}`);
  process.exit(1);
}

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    fail(`${label} is missing: ${targetPath}`);
  }
}

if (rendererMode === "compat") {
  run("node scripts/sync-electron-ui.cjs");
} else {
  run("pnpm frontend:build");
}

const selectedSourceDir =
  rendererMode === "compat" ? compatSourceDir : rewriteSourceDir;
ensureExists(selectedSourceDir, `renderer source (${rendererMode})`);
ensureExists(path.join(selectedSourceDir, "index.html"), "renderer index.html");

fs.rmSync(runtimeOutputDir, { recursive: true, force: true });
fs.mkdirSync(runtimeOutputDir, { recursive: true });
fs.cpSync(selectedSourceDir, runtimeOutputDir, {
  recursive: true,
  force: true,
});

const manifest = {
  generatedAt: new Date().toISOString(),
  mode: rendererMode,
  source: path.relative(root, selectedSourceDir).replaceAll("\\", "/"),
  output: path.relative(root, runtimeOutputDir).replaceAll("\\", "/"),
};

fs.writeFileSync(
  path.join(runtimeOutputDir, "renderer-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `[prepare-desktop-runtime] prepared mode=${rendererMode} source=${manifest.source} output=${manifest.output}`,
);
