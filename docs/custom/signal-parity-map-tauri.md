# Tauri Signal Parity Map Closure (Thread/Turn/Approval/Auth/Cloud)

This document tracks parity mapping between official desktop runtime signals and this Tauri rewrite.
It includes thread/turn/approval/auth behavior plus the desktop cloud lifecycle shim used by this repository.

## Closure criteria

- Thread, turn, approval, MCP-auth, and cloud lifecycle rows have concrete Tauri/frontend equivalents.
- OAuth parity deferrals are removed from local parity docs.
- Parity checks are CI-gated for parity-touching pull requests.

## Signal map

| Surface | Official method/event | Tauri/Frontend equivalent | Evidence in repo |
| --- | --- | --- | --- |
| Thread lifecycle | `thread/start` | `requestAppServer({ method: "thread/start" })` | `src/app/services/cli/turns.ts`, `src-tauri/src/main.rs` |
| Thread lifecycle | `thread/resume` | `requestAppServer({ method: "thread/resume" })` | `src/app/services/cli/turns.ts` |
| Thread lifecycle | `thread/list` | `requestAppServer({ method: "thread/list" })` | `src/app/services/cli/threads.ts` |
| Thread lifecycle | `thread/read` | `requestAppServer({ method: "thread/read" })` | `src/app/services/cli/threads.ts`, `src/app/services/cli/useThreadDetail.ts` |
| Thread lifecycle | `thread/archive` / `thread/unarchive` | archive/unarchive wrappers in thread service | `src/app/services/cli/threads.ts`, `src/app/components/sidebar/AppSidebar.tsx`, `src/app/routes/SettingsPage.tsx` |
| Turn lifecycle | `turn/start` | `requestAppServer({ method: "turn/start" })` | `src/app/services/cli/turns.ts` |
| Turn lifecycle | `turn/interrupt` | `requestAppServer({ method: "turn/interrupt" })` | `src/app/services/cli/turns.ts` |
| Turn lifecycle notification | `turn/started` / `turn/completed` | active-run + timeline updates from app-server stream | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/activeRuns.ts` |
| Turn item streaming | `item/agentMessage/delta` | mapped to run events and message stream consumers | `src/app/services/cli/eventMapper.ts`, `src/app/services/cli/useAppServerEvents.ts` |
| Approval request | `item/commandExecution/requestApproval` | request listener + approval store | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/approvals.ts` |
| Approval request | `item/fileChange/requestApproval` | request listener + approval store | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/approvals.ts` |
| Approval item lifecycle | `item/started` / `item/completed` | approval item context + result transitions | `src/app/services/cli/approvals.ts` |
| Auth API | `account/login/start` / `account/logout` / `account/login/cancel` | typed account service wrappers | `src/app/services/cli/account.ts` |
| Auth notification | `account/login/completed` | auth notification parser + sidebar/UI state updates | `src/app/services/cli/authNotifications.ts`, `src/app/components/sidebar/AppSidebar.tsx` |
| Auth state | `account/read` / `getAuthStatus` | account query + settings provider status hydration | `src/app/services/cli/account.ts`, `src/app/services/cli/config.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP OAuth request | `mcpServer/oauth/login` | typed MCP OAuth helper + settings connect action | `src/app/services/cli/config.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP OAuth completion | `mcpServer/oauthLogin/completed` | auth notification parser + MCP reload/refresh workflow | `src/app/services/cli/authNotifications.ts`, `src/app/services/cli/useAppServerStream.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP auth/runtime status | `mcpServerStatus/list` | v2 `authStatus` parsing to `connected`/`needs_auth`/`disabled`/`error` | `src/app/services/cli/config.ts` |
| Compat bridge wrappers | `mcp-*`, `persisted-atom-*`, `shared-object-*`, workspace onboarding wrappers (`electron-*workspace*`), login redirect/open-link (`open-in-browser`), restart/debug/diff/terminal direct messages, `electron-window-focus-request` | Tauri bridge message handler + compat channel events | `src-tauri/src/main.rs`, `src/app/services/host/runtime.ts` |
| Cloud run command | Electron cloud orchestration | `cloud_run_start` host command + frontend shim | `src-tauri/src/main.rs`, `src-tauri/src/cloud_host.rs`, `src/app/services/cli/cloudRuns.ts` |
| Cloud run cancel | Electron cloud stop action | `cloud_run_cancel` host command (real process kill) | `src-tauri/src/main.rs`, `src-tauri/src/cloud_host.rs`, `src/app/components/threads/ThreadComposer.tsx` |
| Cloud run list | Cloud run resume/visibility | `cloud_run_list` host command + active run map | `src-tauri/src/main.rs`, `src-tauri/src/cloud_host.rs`, `src/app/services/host/cloudRuns.ts` |
| Cloud run lifecycle events | cloud task status/output/completion stream | `cloud-run-started`, `cloud-run-status`, `cloud-run-output`, `cloud-run-completed` events mapped into timeline model | `src-tauri/src/cloud_host.rs`, `src/app/services/cli/cloudRuns.ts`, `src/app/services/cli/events.ts` |

## Test coverage references

- `src/app/router.test.tsx`
- `src/app/components/sidebar/AppSidebar.test.tsx`
- `src/app/routes/SettingsPage.test.tsx`
- `src/app/services/cli/cloudRuns.test.ts`
- `src/app/services/cli/config.test.ts`
- `src/app/services/cli/authNotifications.test.ts`
- `src/app/services/cli/terminalSessions.test.ts`
- `src-tauri/src/cloud_host.rs` (unit tests)
- `src-tauri/src/terminal_host.rs` (unit tests)

## Validation commands

- `pnpm format:app:fix`
- `pnpm lint`
- `pnpm frontend:test`
- `pnpm frontend:build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm parity:test:routes`
- `pnpm parity:test:cloud-sidebar-settings`
- `pnpm parity:audit:check`

## Official harness audit artifact

- Latest captured audit JSON: `docs/custom/official-debug-audit-2026-02-10.json`
- Source NDJSON (fixture parity run): `third_party/CodexDesktop-Rebuild/logs/test-audit.ndjson`
