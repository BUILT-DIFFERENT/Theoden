# Update UI Plan Progress

Source plan: `docs/custom/update-ui.md`

## Overall Status

- Plan execution is near-complete.
- All P0 and P1 checklist items in section 5 are complete.
- All Ship Gate items in section 8 are complete except one P2 item.

## Completed Work

- Workspace picker and propagation:
  - Home, sidebar, and bottom bar workspace selection wired.
  - Active workspace checkmark implemented.
  - Workspace switch updates thread lists, labels, and git/branch indicators.
- Primary controls:
  - Run and Open menus are functional and dispatch actions.
  - Sidebar navigation routes correctly to app views.
  - Skills and Automations CTAs open working modals.
- Thread lifecycle:
  - New thread creation in active workspace works.
  - Thread view now renders conversation messages.
  - Composer supports sending and appends optimistic user messages.
- Diff panel:
  - Top-bar git status chip is live and toggles the panel.
  - Staged/unstaged tabs use real git status counts and file lists.
- Bottom bar:
  - Environment pills are interactive.
  - Branch dropdown is interactive, lists branches, and performs checkout.
- Home/new-thread parity:
  - Legacy Command Center top pills removed.
  - Home empty state updated to centered stack with 3-column suggestion cards.
- P2 partial:
  - Automations: create modal + listing complete.
  - Skills: search + installed/recommended + detail modal complete.

## Remaining Work

- `Settings: left-nav + core settings forms` (section 8, P2 Gate) is still unchecked.

## Suggested Next Task

- Implement the Settings left-side category navigation and route-backed core forms:
  `General`, `Configuration`, `Personalization`, `MCP servers`, `Skills`, `Git`, `Environments`, `Worktrees`, `Archived threads`.
