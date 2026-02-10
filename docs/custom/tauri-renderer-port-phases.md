# Tauri Renderer Port Phases

Last updated: February 10, 2026

This document tracks the Electron-compat to native rewrite migration plan and the implemented guardrails.

## Current rollout policy

- Default desktop renderer mode: `compat`
- Optional desktop renderer mode: `rewrite`
- Mode selector: environment variable `CODEX_DESKTOP_RENDERER_MODE` (`compat` or `rewrite`)
- Prepared runtime output: `out/desktop-runtime`

## Implemented foundations

### Phase 0: Baseline lock

- Locked parity scope and baseline references in `docs/custom/parity-baseline-lock.json`.
- Added baseline verification script: `pnpm parity:check:baseline-lock`.
- Baseline audit reference pinned to `docs/custom/official-debug-audit-2026-02-10.json`.

### Phase 1: Dual renderer runtime

- Added `scripts/prepare-desktop-runtime.cjs` to materialize runtime assets into `out/desktop-runtime`.
- `compat` mode source: `out/electron-ui` (through existing `sync-electron-ui` pipeline).
- `rewrite` mode source: `dist` (built from `src/` via `pnpm frontend:build`).
- Updated `src-tauri/tauri.conf.json`:
  - `beforeBuildCommand`: `pnpm prepare:desktop-runtime`
  - `beforeDevCommand`: `pnpm prepare:desktop-runtime`
  - `frontendDist`: `../out/desktop-runtime`
- Added explicit mode scripts:
  - `pnpm desktop:dev:compat`
  - `pnpm desktop:dev:rewrite`
  - `pnpm desktop:build:compat`
  - `pnpm desktop:build:rewrite`

### Phase 2: Contract stabilization

- Added typed adapter boundary at `src/app/services/host/adapter.ts`.
- Added host runtime mode command and wrapper:
  - Tauri command: `host_get_renderer_mode`
  - Frontend wrapper: `getHostRendererMode` in `src/app/services/host/runtime.ts`
- Updated rewrite bootstrap to initialize Electron compatibility bridge only when host mode is `compat`.
- Added rewrite boundary guard: `pnpm parity:check:bridge-boundary` to prevent direct `window.electronBridge` usage outside `src/app/services/bridge/electronCompat.ts`.

### Phase 3: Shell/navigation parity gate enablement

- Added renderer-mode parity matrix check: `pnpm parity:check:renderer-mode-matrix`.
- Matrix validator runs scoped parity suites in both modes:
  - `compat`
  - `rewrite`
- CI parity workflow now includes `Parity renderer mode matrix` as a required gate.

### Phase 4: Core thread slice parity gating

- Added thread slice parity suite: `pnpm parity:test:thread-slice`.
- Added focused tests for `/` and `/t/:threadId` behavior in `src/app/routes/ThreadPage.test.tsx`:
  - new-thread draft/modal reset behavior
  - thread workspace synchronization from subtitle
  - optimistic user message append on submit
- Added standalone CI gate `Parity thread slice suite`.
- Renderer mode matrix now runs thread-slice parity tests in both `compat` and `rewrite` modes.

### Phase 5: Review/git/terminal slice parity gating

- Added review/git/terminal parity suite: `pnpm parity:test:review-git-terminal`.
- Added focused git hunk/file behavior coverage in `src/app/services/git/changes.test.ts`:
  - stage file + stage hunk
  - unstage with `restore`/`reset` fallback
  - revert file/hunk variants (staged + unstaged)
  - tolerant handling for `patch does not apply` during staged hunk revert
- Added standalone CI gate `Parity review/git/terminal suite`.
- Renderer mode matrix now runs review/git/terminal parity tests in both `compat` and `rewrite` modes.

### Phase 6: Automations/settings/cloud slice parity gating

- Added automations/settings/cloud parity suite: `pnpm parity:test:automations-cloud-settings`.
- Added standalone CI gate `Parity automations/cloud/settings suite`.
- Suite coverage includes:
  - `/automations` route behavior
  - settings route behavior
  - account and auth notification handling
  - automations and cloud run service contracts
- Renderer mode matrix now runs automations/settings/cloud parity tests in both `compat` and `rewrite` modes.

## Parity contract checks

The parity contract suite now includes:

- `pnpm parity:check:baseline-lock`
- `pnpm parity:check:routes-scope`
- `pnpm parity:check:ui-motion`
- `pnpm parity:check:feature-contract`
- `pnpm parity:check:bridge-boundary`
- `pnpm parity:check:renderer-mode-matrix`
