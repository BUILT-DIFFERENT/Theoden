# 20 - End-To-End Flows

## Flow A: App startup to usable chat UI

1. Electron main loads `main-CQwPb0Th.js`.
2. Main initializes managers, menu, and app-server connection.
3. Main creates/focuses primary window and loads webview entry.
4. Preload exposes bridge APIs and build/session metadata.
5. Renderer bootstraps route tree and subscribes to host events.
6. Renderer sends `ready` and focus messages.
7. Host and renderer exchange workspace/thread state sync.

## Flow B: Start thread and stream turn

1. Renderer dispatches fetch/MCP request wrappers for thread/turn actions.
2. Host forwards internal request to app-server (`thread/start`, `turn/start`).
3. App-server emits notifications (`turn/started`, item deltas, `turn/completed`).
4. Host forwards events to relevant renderer windows.
5. Renderer updates conversation timeline and diff/review state.

## Flow C: Automation run to inbox/review

1. Automation definition exists in TOML + sqlite schedule metadata.
2. Host creates/updates run row in `automation_runs`.
3. Host starts thread/turn with automation prompt context.
4. Run transitions through statuses (`IN_PROGRESS` -> `PENDING_REVIEW`/`ACCEPTED`/`ARCHIVED`).
5. Inbox queries read joined `automation_runs` + `automations` projection.

## Flow D: Terminal interaction

1. Renderer sends `terminal-create`.
2. Host creates PTY session via `node-pty` and emits attach/init.
3. Renderer writes/resizes; host forwards to PTY.
4. PTY output is emitted as `terminal-data` and lifecycle events.
5. Close path tears down session and notifies renderer.

## Flow E: Thread overlay proxy

1. Renderer requests `open-thread-overlay`.
2. Host opens overlay window tied to conversation context.
3. Proxy start/interrupt request/response events bridge between primary and overlay contexts.
4. Stream state updates are rebroadcast with host-aware routing.
