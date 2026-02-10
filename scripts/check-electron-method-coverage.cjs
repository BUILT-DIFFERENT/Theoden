#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const queryManifestPath = path.join(
  root,
  "third_party",
  "CodexDesktop-Rebuild",
  "docs",
  "parity",
  "rpc-queries.json",
);
const mutationManifestPath = path.join(
  root,
  "third_party",
  "CodexDesktop-Rebuild",
  "docs",
  "parity",
  "rpc-mutations.json",
);
const dispatchModulePath = path.join(
  root,
  "src-tauri",
  "src",
  "electron_method_dispatch.rs",
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
    throw new Error(`Unable to locate ${constName} in ${dispatchModulePath}`);
  }
  const values = [];
  const itemRe = /"([^"]+)"/g;
  let item;
  while ((item = itemRe.exec(match[1])) !== null) {
    values.push(item[1]);
  }
  return values;
}

const queries = readJson(queryManifestPath).methods;
const mutations = readJson(mutationManifestPath).methods;
const dispatchSource = fs.readFileSync(dispatchModulePath, "utf8");
const queryCoverage = extractRustArray(dispatchSource, "QUERY_METHODS");
const mutationCoverage = extractRustArray(dispatchSource, "MUTATION_METHODS");

const missingQueries = queries.filter(
  (method) => !queryCoverage.includes(method),
);
const extraQueries = queryCoverage.filter(
  (method) => !queries.includes(method),
);
const missingMutations = mutations.filter(
  (method) => !mutationCoverage.includes(method),
);
const extraMutations = mutationCoverage.filter(
  (method) => !mutations.includes(method),
);

if (
  missingQueries.length > 0 ||
  extraQueries.length > 0 ||
  missingMutations.length > 0 ||
  extraMutations.length > 0
) {
  console.error("Electron method coverage check failed.");
  if (missingQueries.length > 0) {
    console.error("Missing query methods:");
    missingQueries.forEach((method) => console.error(`- ${method}`));
  }
  if (extraQueries.length > 0) {
    console.error("Unexpected query methods:");
    extraQueries.forEach((method) => console.error(`- ${method}`));
  }
  if (missingMutations.length > 0) {
    console.error("Missing mutation methods:");
    missingMutations.forEach((method) => console.error(`- ${method}`));
  }
  if (extraMutations.length > 0) {
    console.error("Unexpected mutation methods:");
    extraMutations.forEach((method) => console.error(`- ${method}`));
  }
  process.exit(1);
}

console.log(
  `Electron method coverage passed (${queries.length} query, ${mutations.length} mutation methods).`,
);
