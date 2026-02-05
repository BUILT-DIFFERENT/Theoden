# Implementation Notes

## Event streaming

The runner should emit events as an append-only stream. The UI renders event order rather than recomputing state.

## Parallelism

- Multiple runs can execute concurrently across projects.
- The control room view should never block while runs are active.

## CLI integration

- Prefer calling the CLI over re-implementing logic.
- Desktop should store threads in the same transcript store.
- Providers must be thin wrappers over Codex CLI commands.
- Use `codex app-server` for threads, turns, config, auth, and skills.
- Use `codex cloud exec` for cloud tasks.

## Error handling

- Provider errors mark the thread as failed.
- Partial results should still be visible.

## Stubs in this scaffold

- Cloud provider is stubbed in `src/app/services/providers/cloudProvider.ts`.
- CLI config and history are stubbed in `src/app/services/cli`.
- Git worktree helpers are stubbed in `src/app/services/git`.
- CLI execution bridge is stubbed in `src-tauri/src/main.rs`.
