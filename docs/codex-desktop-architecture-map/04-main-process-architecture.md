# 04 - Main Process Architecture

## Entrypoint and bootstrap

- `main.js` requires `main-CQwPb0Th.js`.
- `app.whenReady()` sequence includes:
  - protocol/deep-link setup
  - optional internal devbox cache refresher
  - update manager initialization
  - menu refresh and primary window creation

## Core managers visible in bundle

- Window manager and host context routing
- Sparkle update manager (`codex_desktop:check-for-updates` handler)
- App-server connection manager (spawn + JSON-RPC/MCP framing)
- Terminal manager (`node-pty` based)
- Desktop notification manager
- Thread overlay manager
- Shared object + persisted atom synchronization

## Critical host-side IPC registrations

- Message ingress from renderer:
  - `codex_desktop:message-from-view`
- Worker ingress registrations per worker id:
  - `codex_desktop:worker:${id}:from-view`
- Other direct handlers:
  - `codex_desktop:show-context-menu`
  - `codex_desktop:trigger-sentry-test`
  - `codex_desktop:get-sentry-init-options` (sync on)
  - `codex_desktop:get-build-flavor` (sync on)

## Global state keyspace

See `appendices/global-state-keys.md`.

Key examples:

- git behavior: branch prefix, force push, commit/pr instructions
- workspace roots and labels
- pinned thread IDs and thread titles
- open-in target preferences

## Host handler registry

Main exposes a 66-method async handler registry (`handlers={...}`).

Full list: `appendices/host-handler-api.md`
