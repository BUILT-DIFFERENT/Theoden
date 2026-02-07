# Codex Desktop Rebuild Architecture Map

This directory is a static, end-to-end architecture map of the official desktop rebuild artifacts in:

- `third_party/CodexDesktop-Rebuild/`
- `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/`

It is based on shipped build output, debug harness scripts, and extracted inventories from the unminified mirror where available.

## What this map covers

- Build and packaging model (Electron Forge, native module pruning, codex binary embedding)
- Runtime topology (main process, preload bridge, renderer, worker threads, app-server process)
- Message contracts and flow (renderer dispatches, host switch cases, bridge channels)
- Host handler API surface (66 async handlers)
- Route and settings topology
- Persistence (global state + sqlite schema + automations run state)
- Terminal, notifications, MCP auth, and debug/audit harness architecture
- End-to-end lifecycle sequences

## What this map does not do

- It does not reconstruct missing sourcemaps.
- It does not deobfuscate files beyond the existing `tmp/codex-wakaru` output.
- It does not claim byte-for-byte source equivalence with internal upstream source trees.

## Reading order

1. `00-scope-and-methodology.md`
2. `01-artifact-inventory.md`
3. `03-runtime-topology.md`
4. `04-main-process-architecture.md`
5. `05-preload-bridge.md`
6. `06-renderer-architecture.md`
7. `07-worker-architecture.md`
8. `08-ipc-and-message-flow.md`
9. `12-state-and-persistence.md`
10. `13-database-and-automations.md`
11. `20-end-to-end-flows.md`
12. `21-gaps-and-open-questions.md`

## Appendix inventory

Generated inventories live under `appendices/`:

- `appendices/host-handler-api.md`
- `appendices/renderer-dispatch-messages.md`
- `appendices/renderer-subscriptions.md`
- `appendices/renderer-command-hooks.md`
- `appendices/routes.md`
- `appendices/settings-lazy-chunks.md`
- `appendices/main-switch-cases.md`
- `appendices/main-message-types.md`
- `appendices/global-state-keys.md`
- `appendices/external-urls.md`

## Deep inventory set

Large-scale extracted inventories live under `inventories/`:

- `inventories/README.md`
- `inventories/00-root-topology.md`
- `inventories/01-scripts-catalog.md`
- `inventories/02-vite-build-artifacts.md`
- `inventories/03-webview-assets-js.md`
- `inventories/04-webview-assets-non-js.md`
- `inventories/05-unminify-safe-js-files.md`
- `inventories/06-key-bundle-anchors.md`
- `inventories/07-renderer-heavy-chunks.md`
- `inventories/08-locale-chunk-catalog.md`
- `inventories/09-debug-harness-files.md`
- `inventories/10-original-to-unminify-path-map.md`
