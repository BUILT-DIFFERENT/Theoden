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
| Automation scheduler | Desktop periodic due-run pickup | Scheduler task in `src-tauri/src/main.rs` | Due automation rows trigger `thread/start` + `turn/start`; run status/inbox reconciliation happens on `turn/completed` terminal notifications |
| Terminal host channel | Host-managed terminal stream contract | `src-tauri/src/terminal_host.rs` + `terminal_*` commands/events | Terminal create/attach/write/resize/close commands and `terminal-*` events working |
| Persisted atom state | Host-synchronized persisted atoms | `src-tauri/src/state_store.rs` + `persisted_atom_*` commands | Workspace/settings/thread cache metadata writes mirrored to host store |
| Settings runtime parity | `config/read`, `mcpServerStatus/list`, `getAuthStatus`, `account/rateLimits/read`, `account/rateLimits/updated` | `src/app/services/cli/config.ts`, `src/app/services/cli/accountUsage.ts`, `src/app/routes/SettingsPage.tsx` | MCP/auth/account usage sections source runtime APIs and live notification refreshes instead of static fallbacks |
| Worktree settings parity | `git worktree list --porcelain`, `git worktree remove` | `src/app/services/git/worktrees.ts`, `src/app/routes/SettingsPage.tsx` | Worktree inventory rows render with row actions, linked-thread navigation, and empty/loading/error states |
| Skills/account parity | `skills/*`, `account/*` app-server methods | existing CLI service layer | Existing flows continue to pass lint/tests/build after backend changes |

## Intentional Deviations

- Cloud execution remains unavailable for this milestone (`cloud` provider marked unavailable; orchestration deferred).
- Terminal host uses command-based streaming rather than full PTY emulation for V1.
- Persisted atom synchronization is host-backed in desktop mode with non-desktop local fallback retained.

## Runtime Remediation Update (2026-02-07)

- App-server bridge now uses a queued stdin writer and wait-based child lifecycle handling (`tokio::select!`) instead of periodic `try_wait` polling.
- App-server pending request cleanup is centralized on bridge teardown, and timeout events remain emitted per request.
- App-server bridge now exposes internal notification subscriptions for host-side consumers while retaining frontend `app-server-notification` events.
- Automation scheduler now supports wake-on-change signaling and next-due sleep windows instead of fixed 60-second polling cadence.
- Automation run paths now use direct lookup helpers (`automation_by_id`, `run_by_id`) rather than list-and-filter retrieval.
- Automation recurrence now normalizes RRULEs to canonical daily/weekly/monthly forms while preserving legacy monthly-hourly compatibility (`FREQ=HOURLY;INTERVAL=720`).
- Automation run lifecycle is completion-driven: `turn/start` leaves runs `IN_PROGRESS`; `turn/completed` transitions to terminal run states (`PENDING_REVIEW`, `FAILED`, `INTERRUPTED`) and idempotently creates inbox items.
- Inbox read reconciliation now marks both inbox rows and matching automation run `read_at`.
- Persisted atom writes now run in a blocking task with temp-file replacement to reduce async runtime blocking.
- Frontend app-server event consumers now share a single listener hub, reducing duplicate `listen(...)` registrations.
- Turn cancellation path is aligned to protocol-supported `turn/interrupt` only.
- Terminal descriptors now expose explicit capability metadata (`interactive`, `supportsResize`, `mode`) while keeping stateless execution semantics for V1.

## Validation Checklist

- `pnpm format:app:fix`
- `pnpm lint`
- `pnpm frontend:test`
- `pnpm frontend:build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- Optional parity replay: official debug harness (`debug:fixtures:start`, `dev:debug`, `debug:audit --json`)
