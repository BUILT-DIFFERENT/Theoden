# Config and History

## Shared config

The desktop app reads the same configuration used by the CLI. This prevents the desktop from becoming a separate world.

## Merge behavior

- User config is merged with project overrides.
- The Settings page shows effective configuration.
- Invalid TOML surfaces warnings and remediation actions.

## Shared history

- Desktop displays CLI runs and can resume them.
- Desktop-created threads are stored in a CLI-compatible format.
- Resuming a thread should work from either surface.
- The UI should prefer calling the CLI for listing and resuming threads.

## Codex home

- The CLI uses `CODEX_HOME` when set; otherwise defaults to `~/.codex`.
- Rollouts live under `CODEX_HOME/sessions` with archived sessions in `CODEX_HOME/archived_sessions`.
- The desktop should use app-server `thread/list` and `thread/read` rather than scanning folders directly.
- The session index lives at `CODEX_HOME/session_index.jsonl` and is updated when thread names change.
