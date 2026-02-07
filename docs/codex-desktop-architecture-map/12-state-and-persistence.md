# 12 - State And Persistence

## Persistence layers

1. Global state map persisted to disk (JSON file under codex home pathing logic)
2. SQLite state for automation/inbox run indexing
3. App-server-managed thread/turn state via codex CLI process

## Global state keyspace

Reference: `appendices/global-state-keys.md`.

Examples:

- git defaults (`git-branch-prefix`, force-push, commit/pr instructions)
- workspace roots + labels
- pinned threads and thread titles
- open-in target preferences

## Persisted atom synchronization

Renderer emits:

- `persisted-atom-sync-request`
- `persisted-atom-update`
- `persisted-atom-reset`

Host responds/broadcasts:

- `persisted-atom-sync`
- `persisted-atom-updated`

This keeps cross-window UI state consistent while using main process as source of truth.
