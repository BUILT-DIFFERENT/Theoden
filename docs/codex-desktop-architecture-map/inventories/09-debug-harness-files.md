# Debug Harness Files

| File | Bytes | Role |
|---|---:|---|
| `debug-audit/index.js` | 11649 | Parses debug logs and checks parity signal evidence. |
| `debug-harness-verify.js` | 14777 | Validates debug harness hook coverage. |
| `debug-main-hook.js` | 15835 | Hooks ipcMain/webContents for structured telemetry. |
| `debug-redaction/index.js` | 4194 | Redacts tokens/secrets from logs. |
| `debug-renderer-playwright.js` | 6564 | Automates UI interactions for parity checks. |
| `electron-debug-entry.js` | 184 | Electron entry shim for debug mode. |
| `mcp-fixtures/lib.js` | 3656 | Shared fixture helper library. |
| `mcp-fixtures/server-failing.js` | 4041 | Failure-mode MCP fixture server. |
| `mcp-fixtures/server-http.js` | 6182 | HTTP/SSE MCP fixture server. |
| `mcp-fixtures/server-stdio.js` | 4202 | STDIO MCP fixture server. |
| `mcp-fixtures/start.js` | 3909 | Starts all fixture services. |
| `mcp-fixtures/stop.js` | 1479 | Stops fixture services. |
| `start-dev-debug.js` | 5114 | Top-level debug launcher. |
