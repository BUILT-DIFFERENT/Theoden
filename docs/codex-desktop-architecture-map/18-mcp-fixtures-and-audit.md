# 18 - MCP Fixtures And Audit

## Fixture set

- `server-stdio.js`: JSON-RPC stdio fixture, tool list/call support
- `server-http.js`: auth-gated HTTP + SSE fixture
- `server-failing.js`: deterministic failure modes
  - `hard-error`
  - `timeout`
  - `retry-then-success`

Manager scripts:

- `mcp-fixtures/start.js`
- `mcp-fixtures/stop.js`
- `mcp-fixtures/lib.js`

## Audit checks (`debug-audit/index.js`)

Signal groups:

- thread lifecycle (`thread/start`, `thread/resume`, `thread/list`, `thread/read`, `thread/archive`, `thread/unarchive`)
- turn lifecycle (`turn/start`, `turn/interrupt`, `turn/completed`, `item/agentMessage/delta`)
- approval lifecycle (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, approval response token)
- MCP auth status (`getAuthStatus`, `mcpServerStatus/list`, authorized + unauthorized evidence)

## Existing parity map doc

- `third_party/CodexDesktop-Rebuild/docs/unfinished-signal-parity-map.md`

This file maps audited signals to official method names and marks native/Tauri equivalents as TBD.
