# 17 - Debug Harness Architecture

## Primary scripts

- `scripts/start-dev-debug.js`
- `scripts/electron-debug-entry.js`
- `scripts/debug-main-hook.js`
- `scripts/debug-renderer-playwright.js`
- `scripts/debug-audit/index.js`
- `scripts/debug-redaction/index.js`

## Debug main hook capabilities

- wraps `ipcMain.handle` and `ipcMain.on`
- wraps `webContents.send`
- captures renderer console messages
- emits structured NDJSON with schema fields:
  - `direction`, `channel`, `method`, `type`, `threadId`, `turnId`, `requestId`, `status`, `rawPreview`

## Redaction behavior

`debug-redaction` masks:

- bearer/basic auth headers
- cookie values
- tokens/api keys/password fields
- common key formats (OpenAI keys, GitHub tokens, JWT-like tokens, etc.)

## Renderer automation utility

`debug-renderer-playwright.js` attaches over CDP and supports:

- `list`
- `click`
- `type`
- `press`
- `eval`
- `screenshot`

This enables scripted parity checks without modifying runtime code.
