# App-Server Bridge (Primary Integration)

The desktop app is a UI wrapper around the Codex CLI. The primary integration point is `codex app-server`, which exposes a JSON-RPC 2.0 protocol over stdio.

## Why app-server

- It is the official interface used by rich UIs.
- It exposes threads, turns, items, approvals, skills, config, and auth.
- It reads and writes the same rollout history and config as the CLI.

## Process lifecycle

1. Spawn `codex app-server` as a long-lived child process.
2. Send a single `initialize` request with client metadata.
3. Send an `initialized` notification.
4. Use JSON-RPC requests for actions and listen for notifications.

## Thread and history mapping

- `thread/list` powers the control room and history panes.
- `thread/read`, `thread/resume`, and `thread/fork` map to open, continue, and branch actions.
- `thread/loaded/list` can show which threads are active in memory.

## Runs and event streaming

- `turn/start` begins a run.
- The server streams `turn/*` and `item/*` notifications in real-time.
- `turn/completed` indicates terminal state and includes errors when failed.

## Approvals

The UI must respond to server-initiated requests:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

Respond with `{ "decision": "accept" | "decline" }` (optional accept settings for commands).

## Config and models

- `config/read`, `config/value/write`, and `config/batchWrite` drive Settings.
- `model/list` and `collaborationMode/list` drive selectors.

## Auth and account

- `account/read` shows current login state.
- `account/login/start` supports `apiKey` and `chatgpt` auth flows.
- `account/logout` signs out.

## Skills and apps

- `skills/list` enumerates local skills (per-cwd).
- `skills/remote/read` lists downloadable skills (experimental).
- `skills/remote/write` downloads a remote skill (experimental).
- `skills/config/write` enables or disables a skill.
- `app/list` enumerates available app connectors.

Remote skills endpoints are marked experimental in the CLI docs and should be feature-flagged.

## Command execution

- `command/exec` runs a standalone command under Codex sandbox policy.
- This can back the “run command” panel without starting a thread.

## Type generation (future)

Generate protocol types directly from the CLI:

- `codex app-server generate-ts --out <dir>`
- `codex app-server generate-json-schema --out <dir>`

Use these artifacts to keep the desktop app aligned with CLI versions.
