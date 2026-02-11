# Tauri Renderer Port Phases

Last updated: February 11, 2026

This document records the migration closure from dual renderer modes to a single Tauri-native renderer path.

## Current runtime policy

- Desktop runtime mode: `rewrite` only
- Prepared runtime output: `out/desktop-runtime`
- Runtime preparation command: `pnpm prepare:desktop-runtime`
- Tauri build hooks:
  - `beforeBuildCommand`: `pnpm prepare:desktop-runtime`
  - `beforeDevCommand`: `pnpm prepare:desktop-runtime`

## Migration closure summary

### Phase 0-6 (completed)

- Baseline parity scope and route/runtime checks were established.
- Rewrite renderer implementation in `src/` reached parity coverage and became the default.
- Bridge-boundary and feature-contract checks remained in place during transition.

### Phase 7 (completed): remove Electron renderer path

- Removed renderer mode switching from desktop runtime preparation.
- Removed Electron renderer sync pipeline and related scripts.
- Removed frontend Electron compatibility bootstrap (`window.electronBridge`) usage.
- Removed renderer mode matrix check and compat-mode command aliases.

## Active parity contract checks

- `pnpm parity:check:baseline-lock`
- `pnpm parity:check:routes-scope`
- `pnpm parity:check:ui-motion`
- `pnpm parity:check:feature-contract`
- `pnpm parity:check:bridge-boundary`
