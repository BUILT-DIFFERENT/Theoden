# 03 - Runtime Topology

## Process graph

1. Electron main process (`main-CQwPb0Th.js`)
2. Renderer webview (`index-CgwAo6pj.js` + lazy chunks)
3. Preload bridge (`preload.js`)
4. Worker threads (`worker.js`, keyed by `workerId`)
5. External codex CLI app-server process (`codex app-server`)

## Responsibilities by layer

- Main process:
  - window lifecycle, menus, context menus
  - IPC ingress/egress
  - workspace and state mutation
  - DB-backed automation run tracking
  - terminal session manager
  - codex app-server lifecycle + MCP request routing
- Preload:
  - trusted IPC bridge and worker channel multiplexing
- Renderer:
  - UI, routes, state atoms, query orchestration
  - emits typed desktop messages to host
- Worker:
  - per-worker service handlers and telemetry relay
- App-server process:
  - thread/turn methods, auth status, MCP server status, skills/config APIs

## Startup sequence (high level)

1. Main boots and registers IPC channels.
2. Main starts app-server connection manager and initialization handshake.
3. Renderer loads via `app://-/index.html` and subscribes to host signals.
4. Preload exposes `window.electronBridge` + window type.
5. Optional worker threads are started and linked with channel pair:
   - `codex_desktop:worker:${id}:from-view`
   - `codex_desktop:worker:${id}:for-view`
