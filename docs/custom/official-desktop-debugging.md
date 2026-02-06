# Official Desktop Debugging (Submodule)

Use the official desktop app submodule at `third_party/CodexDesktop-Rebuild` as the primary runtime/parity debugging reference before adding custom Tauri-only instrumentation.

This workflow is the fastest way to understand:

- bridge behavior and IPC/app-server message flow,
- cloud/off-cloud task behavior,
- approvals and MCP auth status transitions,
- renderer interaction and reproducible UI evidence.

## Prerequisites

- `pnpm` installed.
- submodule initialized:

```bash
git submodule update --init --recursive third_party/CodexDesktop-Rebuild
```

## Core Workflow

Run commands from `third_party/CodexDesktop-Rebuild`:

```bash
cd third_party/CodexDesktop-Rebuild
pnpm install
pnpm run debug:fixtures:start
pnpm run dev:debug
```

In another terminal:

```bash
cd third_party/CodexDesktop-Rebuild
pnpm run debug:ui -- list
pnpm run debug:ui -- click "button:has-text('New Chat')"
pnpm run debug:ui -- type "textarea" "Hello from Playwright"
pnpm run debug:ui -- press Enter
pnpm run debug:ui -- screenshot
pnpm run debug:audit -- --log logs
pnpm run debug:audit -- --log logs --json
pnpm run debug:fixtures:stop
```

## What This Harness Adds

### 1) Structured NDJSON telemetry

Main-process debug hook emits machine-readable NDJSON alongside text logs.
Fields include:

- `schemaVersion`, `runId`, `sessionId`, `pid`, `appFlavor`
- `ts`, `direction`, `channel`, `method`, `type`, `threadId`, `turnId`, `requestId`, `status`, `rawPreview`

Source:

- `third_party/CodexDesktop-Rebuild/scripts/debug-main-hook.js`

### 2) Run/session metadata propagation

`dev:debug` generates and forwards run/session identifiers so logs correlate cleanly across a debug run.

Source:

- `third_party/CodexDesktop-Rebuild/scripts/start-dev-debug.js`

### 3) Redaction pipeline

Sensitive data is redacted before NDJSON write, including:

- `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`
- bearer tokens, JWT-like tokens, common API key patterns
- cookie values masked while keeping key names

Source:

- `third_party/CodexDesktop-Rebuild/scripts/debug-redaction/index.js`

### 4) Playwright/CDP renderer control

`debug:ui` supports deterministic UI interaction and screenshots:

- `list`, `click`, `type`, `press`, `screenshot`, `eval`

Source:

- `third_party/CodexDesktop-Rebuild/scripts/debug-renderer-playwright.js`

### 5) MCP fixture matrix

Isolated local fixtures for repeatable behavior:

- `stdio` fixture: deterministic tools and tool calls
- `http` fixture: header/bearer auth and unauthorized path
- `failing` fixture: hard error, timeout, retry-then-success

Sources:

- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/start.js`
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/stop.js`
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/server-stdio.js`
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/server-http.js`
- `third_party/CodexDesktop-Rebuild/scripts/mcp-fixtures/server-failing.js`

### 6) Audit CLI

`debug:audit` validates captured NDJSON for:

- thread lifecycle,
- turn lifecycle (+ deltas/interrupt),
- approval request/response flow,
- MCP auth/status signals.

Use `--json` for CI-friendly output.

Source:

- `third_party/CodexDesktop-Rebuild/scripts/debug-audit/index.js`

### 7) Parity map

Signal mapping between official app methods/events, native/Tauri equivalents (`TBD` where unknown), and CLI/protocol source:

- `third_party/CodexDesktop-Rebuild/docs/signal-parity-map.md`

OAuth fixture parity is explicitly deferred to a v2 follow-up.

## Useful Environment Variables

- `CODEX_DEBUG_INSPECT_PORT` (main process inspect, default `9229`)
- `CODEX_DEBUG_RENDERER_INSPECT_PORT` (renderer CDP, default `9223`)
- `CODEX_DEBUG_TRACE=0` (disable trace)
- `CODEX_DEBUG_TRACE_IPC=0` (disable IPC trace only)
- `CODEX_DEBUG_OPEN_DEVTOOLS=0` (disable automatic renderer DevTools open)
- `CODEX_DEBUG_CDP_ENDPOINT` (override renderer CDP endpoint used by `debug:ui`)
- `CODEX_DEBUG_RENDERER_TARGET_URL_MATCH` (choose renderer target when multiple tabs exist)
- `CODEX_DEBUG_SCREENSHOT_DIR` (default `logs/screenshots`)

## Notes

- `third_party/CodexDesktop-Rebuild/.gitignore` ignores `logs/` outputs by default.
- Keep intentional parity deviations documented in `docs/custom/` when Tauri behavior cannot exactly match the official reference.
- Current intentional deviation: Windows/Linux use an integrated custom titlebar/menubar (frameless window + webview controls) instead of the native Tauri menu row.
