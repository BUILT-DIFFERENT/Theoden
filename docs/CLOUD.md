# Cloud Execution

## UX expectations

- Cloud mode is a first-class tab in the composer.
- Runs are fire-and-forget with returnable results and PR links.
- Thread history is shared with local runs.
- Cloud tasks execute on Codex Cloud via the CLI, not locally.
- Cloud requires a GitHub-connected repo and produces a PR.

## Provider interface

- Cloud provider mirrors the local provider API.
- It returns a run handle and event stream.
- When remote work finishes, it publishes a summary and diff snapshot.

## CLI integration

- Cloud runs are executed via the Codex CLI.
- The provider invokes `codex cloud exec --env <env_id> [--branch <branch>] [--attempts N]`.
- Results are attributed to the same thread model used for local runs.

## Task lifecycle mapping

- Create: `codex cloud exec` returns a task id.
- Status: `codex cloud status <task_id>` for progress.
- Diff: `codex cloud diff <task_id>` to render review.
- Apply: `codex cloud apply <task_id>` to merge into local workspace.
- List: `codex cloud list --json` to power a Cloud tasks view.

## Sync expectations

- Persist the cloud task id on the originating thread record.
- Poll `codex cloud status` to update the thread status while running.
- When completed, fetch diff and summary to populate the thread timeline.

## MVP approach

- Keep the UI complete even when the backend is stubbed.
- Mark cloud runs as unavailable or stubbed with a clear message.
- Store cloud run metadata alongside local runs for unified history.
