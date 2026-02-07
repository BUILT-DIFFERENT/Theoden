# 10 - Routing And Navigation

## Route map

Reference: `appendices/routes.md`.

Observed route families:

- Root/chat: `/`, `/local/:conversationId`
- Overlay: `/thread-overlay/:conversationId`
- Onboarding/auth: `/first-run`, `/login`, `/welcome`, `/select-workspace`
- Review tooling: `/diff`, `/plan-summary`, `/file-preview`
- Tasks/inbox: `/inbox`, `/remote/:taskId`
- Config/admin: `/settings`, `/skills`, `/announcement`
- Worktree bootstrap: `/worktree-init-v2/:pendingWorktreeId`

## Host-driven navigation signals

Main sends explicit route controls such as:

- `navigate-to-route`
- `navigate-back`
- `navigate-forward`

Renderer command hook subscriptions include:

- `new-chat`, `open-command-menu`, `open-thread-overlay`
- `toggle-sidebar`, `toggle-terminal`, `toggle-diff-panel`

Reference: `appendices/renderer-command-hooks.md`.
