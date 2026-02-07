# 19 - Security And Web Policy

## Webview CSP

`src/webview/index.html` includes strict CSP with:

- `default-src 'none'`
- `script-src 'self'` + specific hash + wasm unsafe eval
- `connect-src 'self' https://ab.chatgpt.com https://cdn.openai.com`

## Bridge isolation model

- Renderer access is mediated through preload-exposed APIs.
- Main process validates trusted IPC events before sensitive operations.

## Debug redaction

Debug pipeline includes proactive redaction before logging NDJSON/plaintext outputs.

## Known risk surfaces

- Any host handler with file/process execution capability is security critical.
- `open-in-browser` validates URL before shell open.
- Terminal and apply-patch flows depend on host-side permission and callsite controls.
