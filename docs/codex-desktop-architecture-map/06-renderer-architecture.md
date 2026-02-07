# 06 - Renderer Architecture

## Runtime stack evidence

From bundle headers and symbols:

- React `19.2.0`
- React DOM client/runtime bundled
- React Router `7.9.4`
- Jotai state atoms
- Sentry browser/electron renderer SDK integration
- Statsig/feature flags runtime present
- Mermaid/Shiki-related chunks present

## Route topology

See `appendices/routes.md` (17 route paths).

Highlights:

- onboarding: `/first-run`, `/login`, `/welcome`, `/select-workspace`
- chat surfaces: `/`, `/local/:conversationId`, `/thread-overlay/:conversationId`
- ops surfaces: `/diff`, `/plan-summary`, `/file-preview`, `/inbox`, `/skills`, `/settings`
- remote/worktree surfaces: `/remote/:taskId`, `/worktree-init-v2/:pendingWorktreeId`

## Renderer->host and host->renderer contracts

- Dispatch messages: `appendices/renderer-dispatch-messages.md` (60)
- Subscriptions: `appendices/renderer-subscriptions.md` (15)
- Command hooks (`m1(...)`): `appendices/renderer-command-hooks.md` (25)

## Asset composition notes

- 434 JS assets in renderer bundle directory.
- Heavy lazy-loading footprint for languages/themes/diagrams and settings sections.
- CSP-constrained webview entry loaded from `src/webview/index.html`.
