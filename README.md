# Codex Desktop (Tauri + React)

This repository contains a desktop app shell for Codex.
The UI runs in Tauri/React and talks to `codex app-server` for thread, turn, config, skills, and command APIs.

## What Is In This Repo

- `src/`: React app (routes, components, state, services)
- `src-tauri/`: Tauri host (window/menu setup, app-server bridge commands)
- `codex-rs/`: Rust workspace for Codex core/app-server/protocol crates
- `docs/custom/`: implementation and parity plan docs

## Current App Routes

- `/`: new thread onboarding + composer
- `/t/$threadId`: active thread, messages, run timeline, approvals, review panel
- `/automations`: automation rules and runs
- `/skills`: local/remote skill management
- `/settings/$section`: runtime/config/settings surfaces

## Prerequisites

- Node.js `>=22`
- pnpm `>=10.28`
- Rust toolchain + Cargo (for Tauri host and `codex-rs` work)
- Platform-native Tauri prerequisites
- `codex` CLI available on `PATH` (desktop shell starts `codex app-server`)

## Quickstart

```bash
pnpm install
pnpm app:dev
```

Run as desktop app:

```bash
pnpm app:tauri dev
```

Build frontend bundle:

```bash
pnpm app:build
```

## Common Commands

- `pnpm format:app` / `pnpm format:app:fix`
- `pnpm lint` / `pnpm lint:fix`
- `pnpm app:test`
- `pnpm app:build`

## Architecture Summary

- Frontend service calls use app-server JSON-RPC methods (for example `thread/*`, `turn/*`, `config/*`, `skills/*`, `command/exec`).
- `src-tauri/src/main.rs` owns process lifecycle for `codex app-server` and forwards notifications/requests into the webview.
- Workspace-aware UI state is centralized in React providers under `src/app/state`.
- Git operations and diff/review actions are wired through `src/app/services/git`.

## Documentation

- Parity and execution plan: `docs/custom/plan.md`
- Manual checklist: `docs/custom/parity-checklist.md`

## License

See `LICENSE` for license terms.
