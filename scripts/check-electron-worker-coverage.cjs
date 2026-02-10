#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workerManifestPath = path.join(
  root,
  "third_party",
  "CodexDesktop-Rebuild",
  "docs",
  "parity",
  "worker-git-methods.json",
);
const workerModulePath = path.join(
  root,
  "src-tauri",
  "src",
  "git_worker_compat.rs",
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractRustArray(source, constName) {
  const re = new RegExp(
    `pub const ${constName}:\\s*&\\[&str\\]\\s*=\\s*&\\[(.*?)\\];`,
    "s",
  );
  const match = re.exec(source);
  if (!match) {
    throw new Error(`Unable to locate ${constName} in ${workerModulePath}`);
  }
  const values = [];
  const itemRe = /"([^"]+)"/g;
  let item;
  while ((item = itemRe.exec(match[1])) !== null) {
    values.push(item[1]);
  }
  return values;
}

const workerMethods = readJson(workerManifestPath).methods;
const workerSource = fs.readFileSync(workerModulePath, "utf8");
const workerCoverage = extractRustArray(workerSource, "GIT_WORKER_METHODS");

const missingMethods = workerMethods.filter(
  (method) => !workerCoverage.includes(method),
);
const extraMethods = workerCoverage.filter(
  (method) => !workerMethods.includes(method),
);

if (missingMethods.length > 0 || extraMethods.length > 0) {
  console.error("Electron worker coverage check failed.");
  if (missingMethods.length > 0) {
    console.error("Missing worker methods:");
    missingMethods.forEach((method) => console.error(`- ${method}`));
  }
  if (extraMethods.length > 0) {
    console.error("Unexpected worker methods:");
    extraMethods.forEach((method) => console.error(`- ${method}`));
  }
  process.exit(1);
}

console.log(
  `Electron worker coverage passed (${workerMethods.length} git worker methods).`,
);
