# 02 - Build And Packaging

## Build stack

- Electron Forge project (`electron` `40.0.0`).
- Main entrypoint: `src/.vite/build/main.js`.
- Product metadata (`package.json`):
  - `productName`: Codex
  - `version`: `1.0.3`
  - `codexBuildFlavor`: `prod`
  - `codexBuildNumber`: `517`

## Packaging strategy

- Aggressive file allow-list in `forge.config.js`:
  - `/src/.vite/build`
  - `/src/webview`
  - `/src/skills`
  - `/node_modules` (further pruned in hook)
- Native module retention list in prune hook:
  - `better-sqlite3`, `node-pty`, and required support packages
  - Optional `electron-liquid-glass` on macOS

## Codex CLI binary resolution for packaged app

`forge.config.js` copies a platform binary into resources via `packageAfterCopy`:

- local path fallback: `resources/bin/<platform-arch>/codex[.exe]`
- npm vendor fallback: `node_modules/@cometix/codex/vendor/<triple>/codex/...`

## Post-build patching scripts

- `patch-process-polyfill.js` injects browser `process` polyfill script into webview HTML.
- `patch-node-pty-spectre.js` applies node-pty hardening patch.
- `patch-i18n.js` and `patch-copyright.js` patch shipped bundle behavior.

## Deliverable format insight

This rebuild is a packaged artifact project, not a typed source tree. Architectural mapping therefore relies on:

- compiled JS bundle analysis,
- runtime/debug harness script inspection,
- and extracted contract surfaces.
