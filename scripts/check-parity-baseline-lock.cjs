#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const lockPath = path.join(root, "docs", "custom", "parity-baseline-lock.json");

function fail(message) {
  console.error(`Baseline lock check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(lockPath)) {
  fail(`missing lock file ${lockPath}`);
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const requiredKeys = [
  "scopeFile",
  "gapRegistryFile",
  "auditBaselineFile",
  "mode",
  "platformScope",
];

for (const key of requiredKeys) {
  if (typeof lock[key] !== "string" || lock[key].trim().length === 0) {
    fail(`lock file key "${key}" must be a non-empty string`);
  }
}

if (lock.mode !== "compat-default") {
  fail(`lock mode must be "compat-default" (received "${lock.mode}")`);
}

if (lock.platformScope !== "windows-linux") {
  fail(
    `lock platformScope must be "windows-linux" (received "${lock.platformScope}")`,
  );
}

const scopePath = path.join(root, lock.scopeFile);
const gapRegistryPath = path.join(root, lock.gapRegistryFile);
const auditBaselinePath = path.join(root, lock.auditBaselineFile);

for (const [label, targetPath] of [
  ["scope file", scopePath],
  ["gap registry file", gapRegistryPath],
  ["audit baseline file", auditBaselinePath],
]) {
  if (!fs.existsSync(targetPath)) {
    fail(`${label} is missing at ${targetPath}`);
  }
}

const auditReport = JSON.parse(fs.readFileSync(auditBaselinePath, "utf8"));
if (auditReport?.summary?.status !== "pass") {
  fail(
    `audit baseline report must be pass (status="${auditReport?.summary?.status ?? "unknown"}")`,
  );
}

const failingChecks = Array.isArray(auditReport.checks)
  ? auditReport.checks
      .filter((check) => check?.status !== "pass")
      .map((check) => check.id)
  : [];

if (failingChecks.length > 0) {
  fail(`audit baseline has failing checks: ${failingChecks.join(", ")}`);
}

console.log(
  `Baseline lock check passed (mode=${lock.mode}, audit=${lock.auditBaselineFile}).`,
);
