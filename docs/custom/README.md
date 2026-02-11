# Custom References

This folder contains project-specific implementation, parity, and debugging references for this Tauri desktop app.

Platform scope for this repository is Windows/Linux only. macOS support is out of scope.

Current docs:

- `docs/custom/plan.md`: gap analysis and implementation parity checklist.
- `docs/custom/parity-backend-v1.md`: backend parity contract, acceptance matrix, and intentional deviations.
- `docs/custom/parity-scope-v2.md`: scoped route/runtime parity contract for Windows/Linux.
- `docs/custom/parity-gap-registry.json`: machine-readable parity gap tracker with closure status.
- `docs/custom/parity-baseline-lock.json`: locked parity baseline references (scope/gap registry/audit artifact) for migration freeze.
- `docs/custom/parity-closure-report.md`: closure evidence map for scoped parity IDs.
- `docs/custom/parity-route-report.md`: scoped route contract checker evidence.
- `docs/custom/parity-motion-report.md`: keyframe/token parity checker evidence.
- `docs/custom/parity-runtime-contract-report.md`: host/bridge contract checker evidence.
- `docs/custom/electron-method-compat-map.md`: Electron UI compat dispatch/translation map for query, mutation, and git worker methods.
- `docs/custom/app-server-adoption-hardening.md`: app-server documented-surface adoption status, outbound method policy, and deferred API-overview backlog.
- `docs/custom/signal-parity-map-tauri.md`: closed signal-level parity mapping for thread/turn/approval/auth + OAuth coverage.
- `docs/custom/codex-app.md`: consolidated product/UX specification.
- `docs/custom/tauri-renderer-port-phases.md`: renderer migration closure and rewrite-only runtime policy.
- `docs/custom/ui-parity-investigation-2026-02-11.md`: Electron-vs-Tauri UI/screen/flow parity findings and applied alias/deeplink updates.
- `docs/custom/official-desktop-debugging.md`: official desktop app submodule debug harness workflow (Playwright/CDP, NDJSON telemetry, fixtures, audit, parity map).
- `docs/custom/titlebar-windows-linux.md`: integrated titlebar/menubar behavior, permissions, and troubleshooting for Windows/Linux.
