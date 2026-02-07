# 08 - IPC And Message Flow

## Renderer-origin message handling

Main host has a large `switch(type)` block for renderer-origin messages.

Full extracted case list: `appendices/main-switch-cases.md` (54 cases in host window).

Major categories:

- fetch bridge: `fetch`, `fetch-stream`, `cancel-*`
- overlays: `open-thread-overlay`, proxy start/interrupt request/response
- workspace onboarding and root management (`electron-*` messages)
- terminal lifecycle (`terminal-create/attach/write/resize/close`)
- notifications (`desktop-notification-show/hide`)
- shared object and persisted atom sync
- app-server and MCP routing (`mcp-request/notification/response`)

## Host-origin messages back to renderer

Observed `type` payloads include:

- navigation and UI controls: `navigate-to-route`, `toggle-*`, `find-in-thread`
- state sync: `persisted-atom-sync`, `persisted-atom-updated`, `workspace-root-options-updated`
- terminal stream: `terminal-attached`, `terminal-data`, `terminal-error`, `terminal-exit`
- thread/automation updates: `thread-title-updated`, `automation-runs-updated`

Reference inventories:

- `appendices/main-message-types.md`
- `appendices/renderer-subscriptions.md`

## App-server wire mode

The host acts as a request/notification broker:

- renderer issues `mcp-request`/`mcp-response` wrappers
- host forwards over app-server stdio JSON-RPC framing
- responses are correlated by request IDs and rebroadcast to relevant windows
