# Tauri Signal Parity Map Closure (Thread/Turn/Approval/Auth)

This document closes the protocol parity mapping gap for desktop runtime signals in this repository.
It maps audited official signals to concrete Tauri/frontend implementations and test coverage.

## Closure criteria

- All thread, turn, approval, and auth signal rows below have concrete native/Tauri equivalents.
- OAuth parity deferrals are removed from local parity docs.
- Verification commands are recorded in this repository (frontend and Tauri validation gates).

## Signal map

| Surface | Official method/event | Tauri/Frontend equivalent | Evidence in repo |
| --- | --- | --- | --- |
| Thread lifecycle | `thread/start` | `requestAppServer({ method: "thread/start" })` | `src/app/services/cli/turns.ts`, `src-tauri/src/main.rs` |
| Thread lifecycle | `thread/resume` | `requestAppServer({ method: "thread/resume" })` | `src/app/services/cli/turns.ts` |
| Thread lifecycle | `thread/list` | `requestAppServer({ method: "thread/list" })` | `src/app/services/cli/threads.ts` |
| Thread lifecycle | `thread/read` | `requestAppServer({ method: "thread/read" })` | `src/app/services/cli/threads.ts`, `src/app/services/cli/useThreadDetail.ts` |
| Thread lifecycle | `thread/archive` / `thread/unarchive` | archive/unarchive wrappers in thread service | `src/app/services/cli/threads.ts`, `src/app/routes/SettingsPage.tsx` |
| Thread lifecycle notification | `thread/started` | notification hub + run/event mapping | `src/app/services/cli/appServerEventHub.ts`, `src/app/services/cli/eventMapper.ts` |
| Turn lifecycle | `turn/start` | `requestAppServer({ method: "turn/start" })` | `src/app/services/cli/turns.ts` |
| Turn lifecycle | `turn/interrupt` | `requestAppServer({ method: "turn/interrupt" })` | `src/app/services/cli/turns.ts` |
| Turn lifecycle notification | `turn/started` / `turn/completed` | active-run + timeline updates from app-server stream | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/activeRuns.ts` |
| Turn item streaming | `item/agentMessage/delta` | mapped to run events and message stream consumers | `src/app/services/cli/eventMapper.ts`, `src/app/services/cli/useAppServerEvents.ts` |
| Approval request | `item/commandExecution/requestApproval` | request listener + approval store | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/approvals.ts` |
| Approval request | `item/fileChange/requestApproval` | request listener + approval store | `src/app/services/cli/useAppServerStream.ts`, `src/app/services/cli/approvals.ts` |
| Approval item lifecycle | `item/started` / `item/completed` | approval item context + result state transitions | `src/app/services/cli/approvals.ts` |
| Auth API | `account/login/start` / `account/logout` / `account/login/cancel` | typed account service wrappers | `src/app/services/cli/account.ts` |
| Auth notification | `account/login/completed` | auth notification parser + sidebar/UI state updates | `src/app/services/cli/authNotifications.ts`, `src/app/components/sidebar/AppSidebar.tsx` |
| Auth legacy fallback | `loginChatGptComplete` | fallback parsing in auth notification module | `src/app/services/cli/authNotifications.ts` |
| Auth state | `account/read` / `getAuthStatus` | account query + settings provider status hydration | `src/app/services/cli/account.ts`, `src/app/services/cli/config.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP OAuth request | `mcpServer/oauth/login` | typed MCP OAuth login helper + settings connect action | `src/app/services/cli/config.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP OAuth completion | `mcpServer/oauthLogin/completed` | auth notification parser + MCP reload/refresh workflow | `src/app/services/cli/authNotifications.ts`, `src/app/services/cli/useAppServerStream.ts`, `src/app/routes/SettingsPage.tsx` |
| MCP auth/runtime status | `mcpServerStatus/list` | v2 `authStatus` parsing into `connected`/`needs_auth`/`disabled`/`error` | `src/app/services/cli/config.ts` |

## Test coverage references

- `src/app/services/cli/account.test.ts`
- `src/app/services/cli/config.test.ts`
- `src/app/services/cli/authNotifications.test.ts`
- `src/app/components/sidebar/AppSidebar.test.tsx`
- `src/app/routes/SettingsPage.mcp.test.tsx`

## Validation commands

- `pnpm format:app:fix`
- `pnpm lint`
- `pnpm frontend:test`
- `pnpm frontend:build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

## Official harness audit artifact

- Captured audit JSON: `docs/custom/official-debug-audit-2026-02-09.json`
- Source NDJSON: `third_party/CodexDesktop-Rebuild/logs/dev-debug-2026-02-09T09-10-21-069Z.ndjson`
