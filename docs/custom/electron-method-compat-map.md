# Legacy Electron Method Compat Map

This document is the authoritative translation/dispatch map for the Electron UI compatibility layer in the Tauri host.

The method registry is defined in:

- `C:/Users/gamer/Documents/Theoden/src-tauri/src/electron_method_dispatch.rs`
- `C:/Users/gamer/Documents/Theoden/src-tauri/src/main.rs` (`handle_electron_query`, `handle_electron_mutation`)
- `C:/Users/gamer/Documents/Theoden/src-tauri/src/git_worker_compat.rs`

Coverage scripts for this legacy compatibility surface were removed when the desktop runtime moved to Tauri rewrite-only mode (February 11, 2026). Keep this map as reference material for remaining host compat internals.

Any method in parity manifests without a corresponding compat dispatch path is a blocker.

## Query Methods

| Method                                | Dispatch target                        | Notes                                                  |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| `account-info`                        | App-server translated (`account/read`) | Response normalized for Electron shape.                |
| `active-workspace-roots`              | Local state store (`global-state`)     | Reads active roots from persisted JSON state.          |
| `child-processes`                     | Local stub                             | Returns empty list.                                    |
| `codex-home`                          | Local host path helper                 | Uses `codex_home_dir()` and exposes worktrees segment. |
| `extension-info`                      | Local host metadata                    | Version/build metadata payload.                        |
| `find-files`                          | Local filesystem walk                  | Walkdir search with depth and result cap.              |
| `get-configuration`                   | Local state store (`configuration`)    | Key/value or full map reads.                           |
| `get-global-state`                    | Local state store (`global-state`)     | Key/value or full map reads.                           |
| `gh-cli-status`                       | Local host probe                       | Checks `gh` availability.                              |
| `gh-pr-status`                        | Local stub                             | Returns unavailable status.                            |
| `git-origins`                         | Local git command                      | Returns `{ origins: [{dir,root,originUrl,commonDir}], homeDir }`. |
| `has-custom-cli-executable`           | Local env probe                        | Uses `CODEX_CLI_PATH`.                                 |
| `ide-context`                         | Local stub                             | Returns `null` context.                                |
| `inbox-items`                         | Automation store                       | Reads inbox rows from SQLite store.                    |
| `is-copilot-api-available`            | Local stub                             | Returns unavailable status.                            |
| `list-automations`                    | Automation store                       | Reads automations from SQLite store.                   |
| `list-pending-automation-run-threads` | Automation store                       | Derived from non-archived runs.                        |
| `list-pinned-threads`                 | Local state store (`global-state`)     | Reads pinned thread IDs list.                          |
| `local-environment`                   | Local host snapshot                    | Returns env/path/shell metadata snapshot.              |
| `local-environments`                  | Local host snapshot                    | Returns array of one local environment descriptor.     |
| `locale-info`                         | Local host/env                         | Uses sanitized locale env hints (`LC_ALL`/`LANG` etc). |
| `open-in-targets`                     | Local stub                             | Returns terminal target metadata.                      |
| `os-info`                             | Local host probe                       | Platform/WSL flags payload.                            |
| `paths-exist`                         | Local filesystem checks                | Filters input paths to existing paths.                 |
| `pending-automation-runs`             | Automation store                       | Reads and filters pending runs.                        |
| `read-file`                           | Local filesystem                       | UTF-8 text read.                                       |
| `read-file-binary`                    | Local filesystem                       | Base64-encoded file bytes.                             |
| `read-git-file-binary`                | Local git command                      | Reads `ref:path` via `git show`, base64-encoded.       |
| `recommended-skills`                  | App-server translated (`skills/list`)  | Pass-through translated response.                      |
| `third-party-notices`                 | Local filesystem                       | Reads `NOTICE` file when present.                      |
| `workspace-root-options`              | Local state store (`global-state`)     | Reads workspace root options/labels.                   |

## Mutation Methods

| Method                          | Dispatch target                     | Notes                                                          |
| ------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `add-workspace-root-option`     | Local state store (`global-state`)  | Inserts root, optional label, optional active root update.     |
| `apply-patch`                   | Local git command                   | Uses host `git apply` wrapper.                                 |
| `automation-create`             | Automation store                    | Creates automation row + TOML mirror file.                     |
| `automation-delete`             | Automation store                    | Deletes automation row + automation directory.                 |
| `automation-run-delete`         | Automation store                    | Deletes run by thread ID and linked inbox item(s).             |
| `automation-run-now`            | Automation runner                   | Executes run against app-server `thread/start` + `turn/start`. |
| `automation-update`             | Automation store                    | Updates automation row + TOML mirror file.                     |
| `generate-pull-request-message` | Local deterministic stub            | Returns null title/body placeholders.                          |
| `generate-thread-title`         | Local deterministic stub            | Returns null title placeholder.                                |
| `gh-pr-create`                  | Local deterministic unsupported     | Returns structured unsupported response.                       |
| `git-checkout-branch`           | Local git command                   | `git checkout <branch>`.                                       |
| `git-create-branch`             | Local git command                   | `git checkout -b <branch> <base>`.                             |
| `git-push`                      | Local git command                   | `git push <remote> <branch>`.                                  |
| `install-recommended-skill`     | Local deterministic unsupported     | Returns structured unsupported response.                       |
| `local-environment-config-save` | Local filesystem                    | Writes raw config content to requested path.                   |
| `open-file`                     | Local host opener                   | Opens `file://` URL via system browser/opener.                 |
| `remove-skill`                  | Local deterministic unsupported     | Returns structured unsupported response.                       |
| `set-configuration`             | Local state store (`configuration`) | Key/value or whole-object writes.                              |
| `set-global-state`              | Local state store (`global-state`)  | Key/value or whole-object writes.                              |
| `set-preferred-app`             | Local state store (`global-state`)  | Persists preferred open target.                                |
| `terminal-attach`               | Terminal host                       | Re-attaches to an existing terminal session.                   |
| `terminal-close`                | Terminal host                       | Closes session and emits terminal events.                      |
| `terminal-create`               | Terminal host                       | Creates managed PTY session.                                   |
| `terminal-resize`               | Terminal host                       | Resizes session PTY dimensions.                                |
| `terminal-write`                | Terminal host                       | Writes input/raw data into session PTY.                        |

## Worker Methods (`workerId = git`)

All methods from `worker-git-methods.json` are dispatched by `git_worker_compat.rs`:

- `apply-changes`
- `base-branch`
- `branch-ahead-count`
- `branch-changes`
- `cat-file`
- `codex-worktree`
- `commit`
- `config-value`
- `create-worktree`
- `current-branch`
- `default-branch`
- `delete-worktree`
- `git-init-repo`
- `index-info`
- `invalidate-stable-metadata`
- `list-worktrees`
- `recent-branches`
- `restore-worktree`
- `set-config-value`
- `stable-metadata`
- `staged-and-unstaged-changes`
- `status-summary`
- `submodule-paths`
- `tracked-uncommitted-changes`
- `untracked-changes`
- `upstream-branch`
- `worktree-snapshot-ref`

## Event Contracts

- App response channel: `codex_desktop:message-for-view`
- Worker response channel: `codex_desktop:worker:<id>:for-view`
- Request/response envelope semantics: JSON-RPC-like envelopes emitted from Tauri host.
- Electron wrapper messages handled in host bridge:
  - `persisted-atom-sync-request` / `persisted-atom-update` / `persisted-atom-reset`
  - `mcp-request` / `mcp-notification` / `mcp-response`
  - `shared-object-subscribe` / `shared-object-unsubscribe` / `shared-object-set`
  - `electron-add-new-workspace-root-option` / `electron-pick-workspace-root-option`
  - `electron-onboarding-skip-workspace` / `electron-update-workspace-root-options`
  - `electron-rename-workspace-root-option` / `electron-set-active-workspace-root`
  - `open-in-browser` (validated `http/https` URLs are opened externally)
  - `codex-app-server-restart`, `open-debug-window`, `show-diff`, `terminal-*`
  - additional Electron-only desktop signals are accepted as no-ops instead of being echoed back
  - `electron-window-focus-request` -> `electron-window-focus-changed`
