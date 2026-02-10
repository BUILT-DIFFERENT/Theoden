#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(
  root,
  "third_party",
  "CodexDesktop-Rebuild",
  "src",
  "webview",
);
const outputDir = path.join(root, "out", "electron-ui");
const bridgeSourcePath = path.join(
  root,
  "src-tauri",
  "bridge",
  "electronBridgeCompat.js",
);
const bridgeOutputPath = path.join(outputDir, "electronBridgeCompat.js");
const indexPath = path.join(outputDir, "index.html");

function fail(message) {
  console.error(`[sync-electron-ui] ${message}`);
  process.exit(1);
}

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    fail(`${label} is missing: ${targetPath}`);
  }
}

function listFiles(baseDir) {
  const files = [];
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const children = fs.readdirSync(current).sort();
      for (const child of children) {
        stack.push(path.join(current, child));
      }
      continue;
    }
    files.push(path.relative(baseDir, current).replaceAll("\\", "/"));
  }
  files.sort();
  return files;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function injectBridgeScript(indexHtml) {
  const bridgeTag = '<script src="./electronBridgeCompat.js"></script>';
  if (indexHtml.includes(bridgeTag)) {
    return indexHtml;
  }
  const moduleScriptPattern = /<script[^>]*type="module"[^>]*>/i;
  const match = moduleScriptPattern.exec(indexHtml);
  if (match) {
    const start = match.index;
    return `${indexHtml.slice(0, start)}${bridgeTag}\n    ${indexHtml.slice(start)}`;
  }

  const headCloseIndex = indexHtml.search(/<\/head>/i);
  if (headCloseIndex !== -1) {
    return `${indexHtml.slice(0, headCloseIndex)}${bridgeTag}\n${indexHtml.slice(headCloseIndex)}`;
  }
  fail("Unable to inject bridge bootstrap into index.html.");
}

ensureExists(sourceDir, "Electron source UI directory");
ensureExists(path.join(sourceDir, "index.html"), "Electron source index.html");
ensureExists(bridgeSourcePath, "Tauri electron bridge source");

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(sourceDir, outputDir, { recursive: true, force: true });

const rawIndex = fs.readFileSync(indexPath, "utf8");
const injectedIndex = injectBridgeScript(rawIndex);
fs.writeFileSync(indexPath, injectedIndex, "utf8");
fs.copyFileSync(bridgeSourcePath, bridgeOutputPath);

const files = listFiles(outputDir);
const fileHashes = files.map((relativePath) => {
  const absolutePath = path.join(outputDir, relativePath);
  return {
    path: relativePath,
    sha256: sha256File(absolutePath),
    sizeBytes: fs.statSync(absolutePath).size,
  };
});
const aggregateHash = crypto
  .createHash("sha256")
  .update(
    fileHashes
      .map((entry) => `${entry.path}:${entry.sha256}:${entry.sizeBytes}`)
      .join("\n"),
  )
  .digest("hex");

const manifest = {
  generatedAt: new Date().toISOString(),
  source: path.relative(root, sourceDir).replaceAll("\\", "/"),
  bridgeSource: path.relative(root, bridgeSourcePath).replaceAll("\\", "/"),
  output: path.relative(root, outputDir).replaceAll("\\", "/"),
  aggregateSha256: aggregateHash,
  fileCount: fileHashes.length,
  files: fileHashes,
};

fs.writeFileSync(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `[sync-electron-ui] synced ${fileHashes.length} files to ${manifest.output}`,
);
