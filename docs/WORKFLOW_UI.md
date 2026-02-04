# Agentic Workflow UI

## Core loop

- Input in a bottom composer.
- Spawn a thread run that scans, plans, edits, tests, and summarizes.
- The user can switch threads while the run continues.
- The sidebar shows all active runs with status chips.

## Layout

- Left sidebar for navigation and thread groups.
- Center pane for timeline and summaries.
- Right panel for diff review, shown only when needed.

## Primary surfaces

- Control room view grouped by project with an Active section.
- Thread view with a run timeline and summary.
- Right panel for context, actions, and quick export to an external editor.

## Composer controls

- Attachments, model dropdown, effort dropdown, lock, mic, send.
- Environment tabs: Local, Worktree, Cloud.
- Branch selector in worktree mode (“From main”).
- When running: send becomes Stop, progress ring shows percent and branch.

## Timeline events

- Planning
- Searched files
- Edited files
- Ran tests
- Summary and next steps

## Status vocabulary

- `queued`
- `running`
- `needs_review`
- `done`
- `failed`

## Event model

Runs emit an append-only event stream. The app-server streams `turn/*` and `item/*` notifications over JSON-RPC, and the UI renders them in order. When a run finishes, it produces a summary and a diff snapshot.
