#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const srcDir = path.join(root, "src");
const allowedFiles = new Set([
  path.join(root, "src", "app", "services", "bridge", "electronCompat.ts"),
]);
const disallowedPatterns = [
  /\bwindow\.electronBridge\b/,
  /\bwindow\.codexWindowType\b/,
  /\bwindow\[\s*["']electronBridge["']\s*\]/,
  /\bwindow\[\s*["']codexWindowType["']\s*\]/,
];

function walk(dirPath) {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

const violations = [];
for (const filePath of walk(srcDir)) {
  if (allowedFiles.has(filePath)) {
    continue;
  }
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (disallowedPatterns.some((pattern) => pattern.test(line))) {
      violations.push({
        file: path.relative(root, filePath).replaceAll("\\", "/"),
        line: index + 1,
        text: line.trim(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Rewrite bridge boundary check failed.");
  violations.forEach((violation) => {
    console.error(`- ${violation.file}:${violation.line}: ${violation.text}`);
  });
  process.exit(1);
}

console.log("Rewrite bridge boundary check passed.");
