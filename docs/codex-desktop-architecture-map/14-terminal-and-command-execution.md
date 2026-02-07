# 14 - Terminal And Command Execution

## Terminal message contract

Renderer dispatches:

- `terminal-create`
- `terminal-attach`
- `terminal-write`
- `terminal-resize`
- `terminal-close`

Host emits:

- `terminal-attached`
- `terminal-init-log`
- `terminal-data`
- `terminal-error`
- `terminal-exit`

## Backend implementation notes

- Main uses `node-pty` (`import("node-pty")`) for PTY sessions.
- Session tracking includes owner webContents, conversation linkage, and preserve flags.
- Terminal lifecycle is mediated by host process, not direct renderer shell calls.

## Related command execution channels

Separate from PTY streaming, host handlers include:

- `child-processes`
- git operations
- workspace snapshot creation/upload

These are surfaced as explicit host API methods rather than ad-hoc renderer process spawns.
