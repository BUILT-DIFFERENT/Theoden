# Parity Route Report

Generated: February 10, 2026

## Inputs

- Scope file: `docs/custom/parity-scope-v2.md`
- Baseline routes: `third_party/CodexDesktop-Rebuild/docs/parity/routes.json`
- App router: `src/app/router.tsx`

## Result

- Command: `pnpm parity:check:routes-scope`
- Status: pass
- Notes:
  - Scoped routes are implemented in router.
  - Baseline extraction does not explicitly list shell-root aliases for `/`, `/t/:threadId`, and `/automations`; this is expected and tracked as non-blocking scope warning by checker output.
