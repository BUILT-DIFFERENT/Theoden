# Parity Scope V2 (Electron -> Tauri)

Last updated: February 10, 2026

This document defines the audited parity scope for the Windows/Linux Tauri rewrite.
Scope is "user + runtime" for all user-visible and runtime-contract-critical behavior.

## Included Route Scope

The following routes are in scope for parity closure and CI enforcement.

- `/`
- `/t/:threadId`
- `/inbox`
- `/login`
- `/welcome`
- `/select-workspace`
- `/automations`
- `/skills`
- `/settings`
- `/settings/:section/*`
- `/local/:conversationId`
- `/remote/:conversationId`
- `/remote/:taskId`
- `/thread-overlay/`
- `/thread-overlay/:conversationId`
- `/diff`
- `/file-preview`
- `/plan-summary`
- `/transcribe`
- `/worktree-init-v2/:pendingId`
- `/worktree-init-v2/:pendingWorktreeId`

## Excluded Route Scope

The following baseline Electron parity routes are intentionally excluded from V2 scope unless product requirements promote them to user/runtime critical.

- `/..`
- `/.codex`
- `/.codex/environments/`
- `/.git`
- `/.git/worktrees/`
- `/debug`
- `/dev/null`
- `/files`
- `/first-run`
- `/home/web_user`
- `/home/you/project`
- `/prompts:`
- `/wham/accounts/check`
- `/wham/environments`
- `/wham/tasks`
- `/wham/tasks/list`
- `/wham/usage`
- `/wham/worktree_snapshots/finish_upload`
- `/wham/worktree_snapshots/upload_url`

## Runtime Contract Scope

Included runtime/host contract surfaces:

- app-server lifecycle, request/notification forwarding, reconnect behavior
- thread/turn/approval/auth/mcp status signals in official audit contract
- deeplink dispatch for in-scope `codex://` routes
- update-check state signaling surface (status + refresh + notification)
- build flavor/status surface consumed by renderer compatibility adapter
- compatibility bridge surfaces used by in-scope flows

Out of scope by default:

- telemetry provider-specific parity (Sentry/DataDog transport internals)
- debug-only harness channels not used by in-scope runtime/UI flows
- macOS-specific window/runtime behavior

## Approved Platform Exceptions

- Windows/Linux integrated custom titlebar/menubar remains an intentional deviation from Electron/native menu implementation. See `docs/custom/titlebar-windows-linux.md`.

## Intentionally Unmapped Channels (Out Of Scope)

- `codex_desktop:get-sentry-init-options`
- `codex_desktop:trigger-sentry-test`
- `codex_desktop:worker:${id}:from-view`
- `codex_desktop:worker:${id}:for-view`

Rationale: these are telemetry/debug or worker-lane channels that are not required for scoped user/runtime parity flows in this repository.

## Baseline References

- `third_party/CodexDesktop-Rebuild/docs/parity/feature-contract.md`
- `third_party/CodexDesktop-Rebuild/docs/parity/routes.json`
- `third_party/CodexDesktop-Rebuild/docs/parity/animations.json`
