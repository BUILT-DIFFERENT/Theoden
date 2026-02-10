# Codex Desktop (Tauri + Electron UI Compat)

This repository contains a Codex desktop app built with a Tauri host and an Electron UI compatibility runtime.
It is targeted to and used by Windows and Linux desktop users, and it connects to `codex app-server` for thread, turn, config, skills, and command APIs.

## Platform Support

- Supported: Windows, Linux
- Unsupported / out of scope: macOS

## Vision

Codex Desktop is a command center for agent-driven software work:

- Threads are the core unit of work.
- Users supervise and direct parallel work across multiple projects/workspaces.
- The app emphasizes reviewable outcomes (diffs, approvals, and git actions), not only prompt/response chat.

## Goal

The goal of this repository is to deliver a parity-focused Tauri implementation of the Codex desktop experience:

- Preserve continuity with Codex CLI/runtime behavior (`codex-cli`, `codex-rs`, and app-server protocol).
- Support long-running and background workflows, including automations.
- Keep collaboration flow centered on planning, execution, review, and shipping changes.

## Experience Principles

- Manager-style workflow: delegate work, monitor progress, and review outcomes.
- Parallelization by default: multiple active threads/workstreams without context loss.
- Cross-surface consistency: desktop behavior aligns with Codex CLI/protocol semantics.
- Durable workflow artifacts: thread history, automation runs, and git changes remain inspectable.

## What Is In This Repo

- `src/`: React rewrite code (kept in-repo for staged refactor, not the default desktop runtime renderer)
- `src-tauri/`: Tauri host (window/menu setup, app-server bridge commands)
- `out/electron-ui/`: synced Electron renderer bundle used for `compat` desktop renderer mode
- `out/desktop-runtime/`: prepared renderer output consumed by Tauri (`frontendDist`)
- `sync-electron-ui.cjs` + `scripts/sync-electron-ui.cjs`: build-time sync pipeline from `third_party/CodexDesktop-Rebuild/src/webview`
- `scripts/prepare-desktop-runtime.cjs`: desktop renderer mode preparation (`compat`/`rewrite`)
- `codex-rs/`: Rust workspace for Codex core/app-server/protocol crates
- `third_party/CodexDesktop-Rebuild/`: official Codex desktop app submodule used for runtime parity tracing/debugging
- `docs/custom/`: implementation and parity plan docs

## Current App Routes

- `/`: new thread onboarding + composer
- `/t/$threadId`: active thread, messages, run timeline, approvals, review panel
- `/inbox`: automation inbox items and unread state
- `/login`: login handoff/entry route
- `/welcome`: onboarding welcome surface
- `/select-workspace`: workspace selector route
- `/local/$conversationId`: legacy/local alias that redirects to `/t/$threadId`
- `/remote/$conversationId`: remote conversation alias with task-link fallback
- `/thread-overlay/$conversationId`: thread route alias that opens review panel
- `/automations`: automation rules and runs
- `/skills`: local/remote skill management
- `/settings/$section`: runtime/config/settings surfaces

## Prerequisites

- Node.js `>=22`
- pnpm `>=10.28`
- Rust toolchain + Cargo (for Tauri host and `codex-rs` work)
- Platform-native Tauri prerequisites (Windows/Linux)
- `codex` CLI available on `PATH` (desktop shell starts `codex app-server`)
- Desktop binary is named `codex-desktop` to avoid colliding with the `codex` CLI executable on Windows
- On Windows, the bridge resolves the npm shim (`codex.cmd`) to the packaged native Codex binary to keep stdio JSON-RPC stable.

## Quickstart

```bash
pnpm install
pnpm frontend:dev
```

Run as desktop app:

```bash
pnpm desktop:dev
```

Run desktop app in explicit renderer mode:

```bash
pnpm desktop:dev:compat
pnpm desktop:dev:rewrite
```

Sync Electron UI bundle only:

```bash
pnpm sync:electron-ui
```

Build frontend bundle:

```bash
pnpm frontend:build
```

Build desktop app:

```bash
pnpm build
```

## Common Commands

- `pnpm format:app` / `pnpm format:app:fix`
- `pnpm lint` / `pnpm lint:fix`
- `pnpm frontend:test`
- `pnpm frontend:build`
- `pnpm desktop:build`
- `pnpm desktop:build:compat`
- `pnpm desktop:build:rewrite`
- `pnpm parity:check:baseline-lock`
- `pnpm parity:check:bridge-boundary`
- `pnpm parity:test:routes`
- `pnpm parity:test:cloud-sidebar-settings`
- `pnpm parity:audit:check`

## Command Map

| Goal                                           | Command                                   |
| ---------------------------------------------- | ----------------------------------------- |
| Web dev server                                 | `pnpm frontend:dev`                       |
| Desktop dev app (default compat mode)          | `pnpm desktop:dev`                        |
| Desktop dev app (forced compat mode)           | `pnpm desktop:dev:compat`                 |
| Desktop dev app (rewrite mode)                 | `pnpm desktop:dev:rewrite`                |
| Frontend production bundle                     | `pnpm frontend:build`                     |
| Desktop production build (default compat mode) | `pnpm build` (or `pnpm desktop:build`)    |
| Desktop production build (forced rewrite mode) | `pnpm desktop:build:rewrite`              |
| Frontend tests                                 | `pnpm frontend:test`                      |
| Route parity snapshot                          | `pnpm parity:test:routes`                 |
| Cloud/sidebar/settings parity suite            | `pnpm parity:test:cloud-sidebar-settings` |
| Baseline lock check                            | `pnpm parity:check:baseline-lock`         |
| Rewrite bridge boundary check                  | `pnpm parity:check:bridge-boundary`       |
| Official audit artifact gate                   | `pnpm parity:audit:check`                 |

## Parity CI Gate

Parity-touching pull requests now run `.github/workflows/tauri-parity-gates.yml` with:

- frontend lint/test/build
- Rust tests for `src-tauri`
- route parity snapshot test
- focused cloud/sidebar/settings parity suite
- official audit artifact pass check

Use `Parity gate results (required)` as the branch protection required status to enforce merge blocking on parity regressions.

## Official Desktop Debug Harness (Submodule)

For bridge/cloud-task/MCP parity debugging, run the official app debug harness in
`third_party/CodexDesktop-Rebuild` instead of adding ad-hoc logging in Tauri first.

```bash
cd third_party/CodexDesktop-Rebuild
pnpm install
pnpm run debug:fixtures:start
pnpm run dev:debug
```

In a second terminal:

```bash
cd third_party/CodexDesktop-Rebuild
pnpm run debug:ui -- list
pnpm run debug:ui -- click "button:has-text('New Chat')"
pnpm run debug:ui -- screenshot
pnpm run debug:audit -- --log logs
pnpm run debug:audit -- --log logs --json
pnpm run debug:fixtures:stop
```

What this harness provides:

- Playwright/CDP renderer interaction (`list`, `click`, `type`, `press`, `screenshot`)
- Structured NDJSON telemetry with run/session correlation metadata
- Built-in redaction for auth headers/tokens/cookies/API keys before NDJSON write
- Local MCP fixture matrix (`stdio`, `http`, `failing`) for deterministic debugging
- Audit checks for thread/turn/approval/MCP-auth signal coverage
- Parity mapping doc at `third_party/CodexDesktop-Rebuild/signal-parity-map.md`

Key submodule debug files:

- `third_party/CodexDesktop-Rebuild/scripts/start-dev-debug.js`
- `third_party/CodexDesktop-Rebuild/scripts/debug-main-hook.js`
- `third_party/CodexDesktop-Rebuild/scripts/debug-renderer-playwright.js`
- `third_party/CodexDesktop-Rebuild/scripts/debug-redaction/index.js`
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/*`
- `third_party/CodexDesktop-Rebuild/scripts/debug-audit/index.js`

## Architecture Summary

- Frontend service calls use app-server JSON-RPC methods (for example `thread/*`, `turn/*`, `config/*`, `skills/*`, `command/exec`).
- `src-tauri/src/main.rs` owns process lifecycle for `codex app-server` and forwards notifications/requests into the webview.
- Desktop runtime is prepared in `out/desktop-runtime` with mode selection through `CODEX_DESKTOP_RENDERER_MODE` (`compat` default, `rewrite` opt-in).
- Host-side persisted state, automations/inbox, and terminal command streaming are exposed through Tauri commands (`persisted_atom_*`, `automation_*`, `inbox_*`, `terminal_*`).
- Automation persistence is stored under `$CODEX_HOME/sqlite/codex-dev.db` and TOML definitions under `$CODEX_HOME/automations/<id>/automation.toml`.
- Workspace-aware UI state is centralized in React providers under `src/app/state`.
- Git operations and diff/review actions are wired through `src/app/services/git`.

## Documentation

- Parity and execution plan: `docs/custom/plan.md`
- Backend parity matrix and deviations: `docs/custom/parity-backend-v1.md`
- Signal-level parity closure map: `docs/custom/signal-parity-map-tauri.md`
- Product/experience specification: `docs/custom/codex-app.md`
- Official desktop debug harness reference: `docs/custom/official-desktop-debugging.md`

## License

See `LICENSE` for license terms.
