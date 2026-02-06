# AGENTS.md

This file is the working guide for agents editing this repository.
It reflects the current desktop app architecture and expected delivery quality.

## 1) Repository Overview

- Desktop app: Tauri host + React frontend.
- App purpose: desktop UI for Codex workflows (threads, turns, diffs, approvals, automations, skills, settings).
- Core bridge: `codex app-server` JSON-RPC methods.

Main folders:

- `src/`: frontend app code.
- `src-tauri/`: Tauri Rust host commands and menu/process plumbing.
- `third_party/CodexDesktop-Rebuild/`: official desktop app (Electron) submodule used for behavior tracing and parity checks.
- `codex-cli/`: official Codex CLI implementation and runtime behavior reference.
- `codex-rs/`: Rust workspace for Codex crates and protocol.
- `docs/custom/`: parity plan and checklist docs.

## 1.1) Required Reference Implementations

For parity-sensitive work, agents must treat these as primary reference sources before inventing new behavior:

- Official desktop app reference: `third_party/CodexDesktop-Rebuild/`
  - Use this to inspect bridge semantics, IPC channels, renderer/main message flow, streaming behavior, and chat/thread sync behavior.
  - Use the debug instrumentation in that repo when validating parity with Tauri implementation.
- Official CLI reference: `codex-cli/` (and related protocol/runtime crates in `codex-rs/`)
  - Use this to implement API interaction patterns, auth/session handling, task execution, config behavior, and cloud/off-cloud execution flows.
  - Prefer reusing or matching existing CLI/protocol behavior over creating new one-off implementations in desktop code.

When implementing features such as bridge wiring, chat sync, cloud tasks, off-cloud tasks, approvals, or MCP flows:

- Compare Tauri behavior against `third_party/CodexDesktop-Rebuild/`.
- Confirm protocol and API behavior against `codex-cli/` + `codex-rs/`.
- Document intentional deviations in `docs/custom/` if parity is not exact.

## 2) App Route Model

- `/`: new thread + onboarding + composer.
- `/t/$threadId`: thread detail, messages, timeline, approvals, review panel.
- `/automations`: automation management.
- `/skills`: installed/recommended/remote skills.
- `/settings/$section`: runtime and config-facing settings screens.

## 3) Frontend Architecture Rules

- Keep UI state in `src/app/state`.
- Keep API/network/business logic in `src/app/services`.
- Prefer app-server API methods over mock/local data when available.
- Avoid duplicating workspace fallback logic; use shared workspace resolution helper.
- When adding command execution behavior, ensure permission profile handling remains wired to `command/exec`.
- Keep route-level failure/loading UX in place when touching router or shell logic.

## 4) Tauri / App-Server Rules

- Tauri host (`src-tauri/src/main.rs`) owns app-server process startup, request forwarding, and lifecycle events.
- Frontend should consume lifecycle events (exit/timeout/reconnect) via shell/bootstrap logic rather than ad-hoc per-page logic.
- Do not add brittle request-id generation in random files; use centralized RPC helpers.

## 5) Git/Diff/Review Rules

- Diff panel should remain hunk-aware for stage/unstage/revert behavior.
- Review annotations should persist to thread/workspace-scoped state, not only transient component state.
- Keep git operations in `src/app/services/git/*` and UI in components.

## 6) Documentation Rules

- If behavior changes, update docs in `docs/custom/` and/or root docs as part of the same change.
- Keep `README.md` aligned with real app behavior and commands.

## 7) Frontend Validation Gate

Run these after meaningful frontend changes:

```bash
pnpm format:app:fix
pnpm lint
pnpm app:test
pnpm app:build
```

If tests fail, fix regressions instead of skipping.

## 8) Rust Workspace Rules (`codex-rs`)

When touching `codex-rs`, follow these requirements:

- Crate names are prefixed with `codex-`.
- Inline `format!` args whenever possible (`format!("{value}")` style).
- Prefer method references over redundant closures.
- Collapse nested `if` statements when clippy expects it.
- Prefer exhaustive `match` over wildcard arms where practical.
- Do not add/modify logic around:
  - `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR`
  - `CODEX_SANDBOX_ENV_VAR`
- If config types (`ConfigToml` or nested types) change:
  - run `just write-config-schema`
  - this updates `codex-rs/core/config.schema.json`.

Rust formatting/lint/test flow:

1. `just fmt` (required after Rust edits).
2. Run targeted crate tests (for changed crate).
3. If shared crates changed (`common`, `core`, `protocol`), run `cargo test --all-features`.
4. For larger Rust changes, run `just fix -p <project>` before finalizing.

## 9) App-Server Protocol Notes (`codex-rs`)

For app-server API development:

- Add new API surface in v2, not v1.
- Use consistent payload naming:
  - `*Params`, `*Response`, `*Notification`.
- Use singular method resources (`thread/read`, `app/list`).
- Keep wire format camelCase and Rust/TS renames aligned.
- Add docs/examples updates when API behavior changes.
- Regenerate schemas when protocol types change:
  - `just write-app-server-schema`
  - and experimental variant when needed.

## 10) Testing Notes

- Prefer deep object equality assertions over field-by-field checks.
- For TUI snapshot updates (if touching `codex-rs/tui`):
  - run `cargo test -p codex-tui`
  - inspect pending snapshots
  - accept only intended snapshots.

## 11) Safety / Change Hygiene

- Do not revert unrelated dirty working-tree changes.
- Keep edits scoped to the requested task.
- Prefer small, reviewable patches.
- If new APIs/settings are added, update docs and validation coverage in the same change.
