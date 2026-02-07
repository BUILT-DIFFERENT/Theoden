# Backend Parity Matrix (V1)

This document tracks backend-focused parity decisions for the Tauri desktop clone.

## Scope Lock

- In scope: core thread/turn/approval flows, app-server bridge parity, SQLite-backed automations/inbox, host terminal channel, persisted atom host state, settings/auth/MCP runtime reads.
- Out of scope: UI polish and cloud execution orchestration (`codex cloud exec` lifecycle).

## Acceptance Matrix

| Area | Source Of Truth | Tauri Implementation | Completion Gate |
| --- | --- | --- | --- |
| App-server lifecycle | `codex app-server` JSON-RPC (`codex-rs/app-server-protocol`) | `src-tauri/src/app_server_bridge.rs` + `app_server_*` commands | `app_server_start/request/notify/respond/stop` compile and pass runtime startup/reconnect checks |
| Thread/turn operations | `thread/*`, `turn/*` methods from app-server | `src/app/services/cli/threads.ts`, `src/app/services/cli/turns.ts` | No mock fallback in Tauri mode for thread list/detail/workspace flows |
| Approval request/response | `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` | `src/app/services/cli/approvals.ts`, `src/app/components/threads/ApprovalsPanel.tsx` | Accept/decline loop preserved with request-id response wiring |
| Diff/review actions | `command/exec` + git CLI behavior | `src/app/services/git/*`, `src/app/components/diff/DiffPanel.tsx` | Hunk stage/unstage/revert remains functional and query invalidation updates |
| Automations persistence | Desktop automation state model + SQLite (`automations`, `automation_runs`, `inbox_items`) | `src-tauri/src/automation_store.rs` + `automation_*`/`inbox_*` commands | Create/update/delete/run/list/archive data persists across restart |
| Automation definitions | Desktop TOML definitions under `$CODEX_HOME/automations/<id>` | `src-tauri/src/automation_store.rs` TOML writes | `automation.toml` created/updated for each automation |
| Automation scheduler | Desktop periodic due-run pickup | Scheduler task in `src-tauri/src/main.rs` | Due automation rows trigger `thread/start` + `turn/start` and produce run/inbox updates |
| Terminal host channel | Host-managed terminal stream contract | `src-tauri/src/terminal_host.rs` + `terminal_*` commands/events | Terminal create/attach/write/resize/close commands and `terminal-*` events working |
| Persisted atom state | Host-synchronized persisted atoms | `src-tauri/src/state_store.rs` + `persisted_atom_*` commands | Workspace/settings/thread cache metadata writes mirrored to host store |
| Settings runtime parity | `config/read`, `mcpServerStatus/list`, `getAuthStatus` | `src/app/services/cli/config.ts`, `src/app/routes/SettingsPage.tsx` | MCP and auth status sourced from runtime APIs instead of static fallbacks |
| Skills/account parity | `skills/*`, `account/*` app-server methods | existing CLI service layer | Existing flows continue to pass lint/tests/build after backend changes |

## Intentional Deviations

- Cloud execution remains unavailable for this milestone (`cloud` provider marked unavailable; orchestration deferred).
- Terminal host uses command-based streaming rather than full PTY emulation for V1.
- Persisted atom synchronization is host-backed in desktop mode with non-desktop local fallback retained.

## Validation Checklist

- `pnpm format:app:fix`
- `pnpm lint`
- `pnpm app:test`
- `pnpm app:build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- Optional parity replay: official debug harness (`debug:fixtures:start`, `dev:debug`, `debug:audit --json`)

