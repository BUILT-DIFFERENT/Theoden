# 13 - Database And Automations

## DB file naming

Main resolves sqlite DB filename as:

- `codex.db` for production flavor
- `codex-dev.db` otherwise

DB path is under codex home `sqlite/` subdirectory.

## Schema (observed migrations)

### `inbox_items`

- initial columns: `id`, `title`
- later columns added: `description`, `thread_id`, `read_at`, `created_at`

### `automations`

- `id`, `name`, `prompt`, `status`, `next_run_at`, `last_run_at`, `cwds`, `rrule`, `created_at`, `updated_at`

### `automation_runs`

- `thread_id`, `automation_id`, `status`, `read_at`, `thread_title`, `source_cwd`, `inbox_title`, `inbox_summary`, `created_at`, `updated_at`
- later columns: `archived_user_message`, `archived_assistant_message`, `archived_reason`

## Automation lifecycle status set

Observed states include:

- `IN_PROGRESS`
- `PENDING_REVIEW`
- `ACCEPTED`
- `ARCHIVED`

## Integration with automation TOML

Bundle text and docs indicate automation setup is in TOML under `$CODEX_HOME/automations/<id>/automation.toml`, with run timing/status tracked in sqlite tables.
