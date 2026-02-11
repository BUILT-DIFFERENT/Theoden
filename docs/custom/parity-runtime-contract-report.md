# Parity Runtime Contract Report

Generated: February 10, 2026

## Inputs

- Baseline runtime contract: `third_party/CodexDesktop-Rebuild/docs/parity/feature-contract.md`
- Tauri host contract: `src-tauri/src/main.rs`, `src-tauri/src/runtime_contract.rs`
- Frontend runtime wrappers: `src/app/services/host/runtime.ts`

## Result

- Command: `pnpm parity:check:feature-contract`
- Status: pass
- Verified:
  - Host deeplink/update/build-flavor command surfaces exist.
  - Frontend typed wrappers exist for command/event contract usage.
