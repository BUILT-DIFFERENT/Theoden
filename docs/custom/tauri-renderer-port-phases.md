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

## Parity contract checks

The parity contract suite now includes:

- `pnpm parity:check:baseline-lock`
- `pnpm parity:check:routes-scope`
- `pnpm parity:check:ui-motion`
- `pnpm parity:check:feature-contract`
- `pnpm parity:check:bridge-boundary`
