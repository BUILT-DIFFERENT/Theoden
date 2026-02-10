# Electron -> Tauri Parity Closure Report

Last updated: February 10, 2026

## Scope

- Scope source: `docs/custom/parity-scope-v2.md`
- Gap registry: `docs/custom/parity-gap-registry.json`
- Baseline references:
  - `third_party/CodexDesktop-Rebuild/docs/parity/feature-contract.md`
  - `third_party/CodexDesktop-Rebuild/docs/parity/routes.json`
  - `third_party/CodexDesktop-Rebuild/docs/parity/animations.json`

## Gap Status Matrix

| Gap ID | Category | Status | Evidence |
| --- | --- | --- | --- |
| `routes.surface.v2` | routes | closed | `pnpm parity:check:routes-scope`, `docs/custom/parity-route-report.md`, `src/app/router.tsx`, `src/app/router.test.tsx` |
| `runtime.deeplink.update` | runtime-contract | closed | `pnpm parity:check:feature-contract`, `docs/custom/parity-runtime-contract-report.md`, `src-tauri/src/runtime_contract.rs`, `src-tauri/src/main.rs`, `src/app/services/host/runtime.ts` |
| `rpc.deferred.activation` | deferred-rpc | closed | `src/app/components/threads/ThreadTopBar.tsx`, `src/app/routes/PlanSummaryPage.tsx` |
| `bridge.compat.layer` | bridge channels | closed | `src/app/services/bridge/electronCompat.ts`, `src/app/services/host/runtime.ts`, `src-tauri/src/main.rs` |
| `motion.token.contract` | motion/tokens | closed | `pnpm parity:check:ui-motion`, `docs/custom/parity-motion-report.md`, `src/styles/parity-keyframes.css`, `src/styles/parity-tokens.css` |
| `ux.flows.hardening` | UX flows | in_progress | `src/app/routes/DiffRoutePage.tsx`, `src/app/routes/TranscribePage.tsx`, `src/app/routes/WorktreeInitPage.tsx` |

## Runtime Contract Exceptions

- Telemetry vendor initialization channels are intentionally not mapped in Tauri parity scope.
- Worker bridge channels are documented but remain out of scope unless surfaced by user-facing workflows.
