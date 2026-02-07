# 09 - Host Handler API Overview

## Registry shape

The host `handlers={...}` table provides an RPC-like local API consumed by renderer query/mutation code.

Total extracted async handlers: 66.

See full list: `appendices/host-handler-api.md`.

## Functional grouping

### Workspace and configuration

- `workspace-root-options`, `active-workspace-roots`, `add-workspace-root-option`
- `get-configuration`, `set-configuration`
- `get-global-state`, `set-global-state`

### Git and PR operations

- `git-origins`, `git-merge-base`, `git-create-branch`, `git-push`
- `generate-pull-request-message`, `gh-pr-create`

### Threads and navigation metadata

- `set-thread-pinned`, `list-pinned-threads`, `set-pinned-threads-order`
- `generate-thread-title`

### Files and workspace snapshot flow

- `find-files`, `read-file`, `read-file-binary`, `read-git-file-binary`
- `prepare-worktree-snapshot`, `upload-worktree-snapshot`
- `open-file`, `pick-file`, `pick-files`

### Automations and inbox

- `list-automations`, `automation-create`, `automation-update`, `automation-delete`
- `automation-run-now`, `pending-automation-runs`, `automation-run-archive`
- `inbox-items`, `list-pending-automation-run-threads`

### Environment, skills, and platform info

- `local-environment*`, `local-environments`
- `recommended-skills`, `install-recommended-skill`, `remove-skill`
- `locale-info`, `os-info`, `third-party-notices`, `codex-home`

### Bridge and diagnostics

- `ipc-request`, `openai-api-key`, `has-custom-cli-executable`
- `child-processes`, `apply-patch`
