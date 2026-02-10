# App-Server Adoption Hardening (2026-02-10)

This document records the documented-surface hardening completed for app-server usage in desktop flows.

## Baseline And Outcome

- Baseline audit (before this patch): `19/27` documented `APP-SERVER.md` API-overview methods used by production UI flows.
- Baseline audit (before this patch): `8/27` documented methods implemented as wrappers but used only in tests.
- Baseline audit (before this patch): production outbound usage included undocumented `skills/remote/read` and `skills/remote/write`.
- Current outcome: model selection now uses documented `model/list` in composer, undocumented remote skills RPC usage is removed from production paths, and host-side lifecycle now gates all non-initialize requests on initialize + initialized readiness.

## Documented-Only Outbound Policy

- All frontend app-server requests through `src/app/services/cli/rpc.ts` are now checked against a documented method allowlist.
- New guardrail test coverage in `src/app/services/cli/rpc.test.ts` fails if an undocumented outbound method is introduced.
- `skills/remote/read` and `skills/remote/write` are blocked by policy and removed from runtime UI flow usage.

## Lifecycle Hardening

- `src-tauri/src/app_server_bridge.rs` tracks app-server readiness with explicit running and initialized state.
- `src-tauri/src/app_server_bridge.rs` enforces `ensure_ready(...)` before non-initialize requests and non-`initialized` notifications.
- `src-tauri/src/main.rs` `app_server_start` now uses host-managed handshake readiness (initialize + initialized) and accepts `clientInfo`.
- `src-tauri/src/main.rs` automation thread/turn start path now calls `ensure_ready(...)` so scheduler runs do not depend on renderer bootstrap timing.
- `src/app/components/layout/AppShell.tsx` no longer performs manual renderer-side initialize/initialized bootstrapping.

## Existing-Flow Adoption Added

- `src/app/components/threads/ThreadComposer.tsx` now sources model options from `model/list` via `src/app/services/cli/useModels.ts`.
- `src/app/components/threads/ThreadComposer.tsx` now passes selected model into `thread/start`, `thread/resume`, and `turn/start` for local/worktree runs.
- `src/app/components/threads/ThreadComposer.tsx`, `src/app/routes/ThreadPage.tsx`, and `src/app/components/diff/DiffPanel.tsx` now start reviewer runs through documented `review/start` instead of prompt-only review requests.
- `src/app/routes/SkillsPage.tsx` report action now submits feedback through documented `feedback/upload`.
- `src/app/routes/LoginPage.tsx` now exposes cancel for pending ChatGPT login flows and routes cancellation through documented `account/login/cancel`.
- `src/app/routes/SettingsPage.tsx` now writes MCP server map through documented `config/value/write` and loads requirements via `configRequirements/read`.

## Deferred API-Overview Methods (No New Surface In This Phase)

- `app/list`
- `collaborationMode/list`
- `thread/fork`
- `thread/loaded/list`
- `thread/rollback`

These remain intentionally deferred for dedicated UI/product work and are already wrapped for test-level method coverage.
