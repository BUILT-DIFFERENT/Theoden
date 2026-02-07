# AGENTS.md

This file is the working guide for agents editing this repository.
It reflects the current desktop app architecture and expected delivery quality.

## 1) Repository Overview

- Desktop app: Tauri host + React frontend.
- Target users/platforms: Windows and Linux desktop users.
- App purpose: desktop UI for Codex workflows (threads, turns, diffs, approvals, automations, skills, settings).
- Core bridge: `codex app-server` JSON-RPC methods.

Main folders:

- `src/`: frontend app code.
- `src-tauri/`: Tauri Rust host commands and menu/process plumbing.
- `third_party/CodexDesktop-Rebuild/`: official desktop debug/parity harness artifacts (not a full source-code reference), used for behavior tracing on hard architecture/parity issues.
- `codex-cli/`: official Codex CLI implementation and runtime behavior reference.
- `codex-rs/`: Rust workspace for Codex crates and protocol.
- `docs/custom/`: parity plan and checklist docs.

## 1.1) Required Reference Implementations

For parity-sensitive work, agents should default to `codex-cli/` + `codex-rs/` for implementation behavior and protocol expectations. Use `third_party/CodexDesktop-Rebuild/` only for debugging and hard architecture/parity investigations.

- Official desktop app debug reference: `third_party/CodexDesktop-Rebuild/`
  - This is a debugging/parity harness and does not provide the full official desktop source code.
  - Do not use this as the default place to inspect implementation details for routine tasks.
  - Use it when investigating hard issues in bridge semantics, IPC channels, renderer/main message flow, streaming behavior, and chat/thread sync behavior.
- Official CLI reference: `codex-cli/` (and related protocol/runtime crates in `codex-rs/`)
  - Match API interaction patterns, auth/session handling, task execution, config behavior, and cloud/off-cloud flows.
  - Prefer reusing existing CLI/protocol behavior over one-off desktop implementations.
- For bridge wiring, chat sync, cloud/off-cloud tasks, approvals, and MCP flows:
  - Compare Tauri behavior against `third_party/CodexDesktop-Rebuild/`.
  - Confirm protocol/API behavior against `codex-cli/` + `codex-rs/`.
  - Document intentional deviations in `docs/custom/` when parity is not exact.

## 1.2) Official Desktop Debugging Workflow (Submodule)

Use the official desktop app debug harness in `third_party/CodexDesktop-Rebuild/` for hard parity/architecture debugging issues (bridge, cloud tasks, approvals, MCP auth/status, renderer interaction). It is not the default reference for routine implementation work.

Run from `third_party/CodexDesktop-Rebuild`:

```bash
pnpm run debug:fixtures:start
pnpm run dev:debug
pnpm run debug:ui -- list
pnpm run debug:ui -- click "button:has-text('New Chat')"
pnpm run debug:ui -- screenshot
pnpm run debug:audit -- --log logs
pnpm run debug:audit -- --log logs --json
pnpm run debug:fixtures:stop
```

Reference files for this workflow:

- `third_party/CodexDesktop-Rebuild/scripts/start-dev-debug.js` (run/session propagation, debug launch)
- `third_party/CodexDesktop-Rebuild/scripts/debug-main-hook.js` (NDJSON telemetry hook)
- `third_party/CodexDesktop-Rebuild/scripts/debug-redaction/index.js` (secret/token redaction)
- `third_party/CodexDesktop-Rebuild/scripts/debug-renderer-playwright.js` (Playwright/CDP UI + screenshots)
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/*` (deterministic fixture matrix)
- `third_party/CodexDesktop-Rebuild/scripts/debug-audit/index.js` (machine-readable parity audit)
- `third_party/CodexDesktop-Rebuild/docs/signal-parity-map.md` (audited-signal mapping and parity tracking)

Working rules:

- Prefer this harness over adding one-off logging in Tauri when reproducing parity bugs.
- Use audit output to verify coverage for thread/turn/approval/MCP-auth flows before declaring parity fixes complete.
- Keep parity gaps and intentional deviations documented in `docs/custom/`.

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

## 7.1) JavaScript Package Manager

- Always use `pnpm` for dependency management and script execution in this repository.
- Do not use `npm` commands (`npm install`, `npm run`, `npx`, etc.) unless a task explicitly requires validating npm-specific behavior.

## 7.2) Build Command Mapping (Avoid Ambiguity)

- If the request is "build the app" for desktop testing, run `pnpm build` (or `pnpm app:tauri build`).
- `pnpm app:build` is frontend-only (`tsc -b && vite build`) and does not produce the desktop executable.
- Desktop executable output path on Windows: `src-tauri/target/release/codex-desktop.exe`.

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

## 12) Execution Loop Guard

- Do not repeat a failing command/path more than 2 times without changing approach.
- If the same failure repeats, stop and perform root-cause analysis (read the relevant code/tests/logs) before retrying.
- After root-cause analysis, prefer a code/config fix over more retries of the same command.
- If blocked after one revised attempt, summarize the blocker and propose 1-2 concrete alternatives instead of continuing to loop.
