# Codex UI Parity Checklist

Use this checklist during release validation for desktop widths (>=1440px) and compact widths (<=1024px).

## Canonical Routes

- [ ] `/` New thread empty state (workspace configured)
- [ ] `/` New thread onboarding (no workspace configured)
- [ ] `/t/:threadId` active thread with messages, composer, bottom bar
- [ ] `/t/:threadId` active thread with review panel open
- [ ] `/automations` list with enabled + paused automations
- [ ] `/automations` run history expanded with live event statuses
- [ ] `/skills` installed catalog + detail modal
- [ ] `/skills` remote catalog under experimental flag
- [ ] `/settings/general`
- [ ] `/settings/environment`

## Interaction Checks

- [ ] Workspace switch from sidebar updates top bar subtitle immediately
- [ ] Workspace switch from sidebar updates composer workspace picker immediately
- [ ] Workspace switch from sidebar updates bottom bar workspace picker immediately
- [ ] `Run now` automation starts run and appends execution history entries
- [ ] Skill `Try` starts a real thread turn (navigates to `/t/:threadId`)
- [ ] Skill install/uninstall persists after refresh via `skills/config/write`
- [ ] No dead clickable controls highlighted in smoke mode (`VITE_UI_SMOKE_TEST=1`)

## Visual Checks

- [ ] Flat surfaces applied consistently (top bar, sidebar, terminal, cards)
- [ ] Radius/spacing/hover tokens are consistent across cards and popovers
- [ ] Scrollbars are visible and consistent in sidebar/main/diff/terminal
- [ ] Icon actions have labels/tooltips where needed and no orphan icon-only dead controls

## Capture Artifacts

- [ ] Save route screenshots before sign-off in `docs/custom/` with route-prefixed filenames
- [ ] Attach smoke test and command gate outputs (`pnpm lint`, `pnpm format:app`, `pnpm app:build`, `pnpm app:test`)
