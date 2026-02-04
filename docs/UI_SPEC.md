# UI Spec (Video Parity)

This document captures the UI behaviors and microcopy observed in the launch demo video, translated into implementation requirements for the desktop app.

## Layout

- Three-column layout: left sidebar, center thread view, optional right review panel.
- Right review panel is a persistent column, not a modal.
- Top toolbar in the center panel shows thread title, workspace, and context actions.

## Left Sidebar

- Primary actions at top: New thread, Automations, Skills.
- Recents list with relative timestamps and attention dots.
- Threads section grouped by workspace/repo with disclosure toggles.
- Active thread row shows diffstat and running indicator.

## Empty State

- Centered cloud glyph and “Let’s build” headline.
- Workspace selector dropdown with checkmark for current selection.
- Starter prompt cards under the empty state.

## Composer

- Bottom-docked rounded input with placeholder: “@ to add files, / for commands”.
- Controls: attach, model dropdown, effort dropdown, lock icon, mic, send button.
- Environment tabs: Local, Worktree, Cloud.
- Branch/base selector: “From main” dropdown in worktree mode.
- While running: send becomes Stop, progress ring shows percent and active branch.

## Thread Timeline

- Compact event list: “Explored…”, “Edited…”, “Listed…”, each clickable for detail.
- Generated summary section with files touched and next steps.
- “Tests not run (per instruction).” line included when applicable.
- Sticky “Review changes” CTA appears when diffs exist.

## Diff / Review Panel

- Header: “Uncommitted changes” with Unstaged / Staged counts.
- Per-file diff headers with + / - counts and disclosure for unchanged lines.
- Bulk actions: Revert all, Stage all.
- Inline comment UI for PR review comments.

## Commit and PR Flow

- Commit modal with branch, diff counts, include-unstaged toggle.
- Commit message placeholder: “Leave blank and Codex will generate a commit message for you.”
- Next steps: Commit, Commit and push, Commit and create PR.
- PR progress modal: “Hold tight, this may take a few moments…”

## Worktree Flow

- “Creating worktree” modal with terminal-like output and progress.
- Output shows created path and setup script steps.
- Primary actions after creation: Checkout on local, Create branch here.

## Skills

- Skills page with Installed and Recommended sections.
- Search bar and “New skill” button.
- Skill detail modal with description and “Open” / “Try”.
- Skill invocation via `$skill-name` creates an inline pill.

## Automations

- Templates gallery with “Let’s automate” header.
- Create automation modal with name, workspace, prompt, schedule.
- Schedule picker: daily vs interval, time picker, day-of-week pills.

## Compact Mode

- Collapse to mini window with chat history and input.
- Always-on-top behavior for fast tweaks while other apps are visible.
- Controls: close, expand, overflow menu.

## Terminal Panel

- Optional terminal panel in main window with streaming output.
- Syntax highlighting and status icons.

## Motion and Microcopy

- Modal open: scale + fade.
- Button hover: slight scale up.
- Loading states: animated ellipsis and progress rings.
- Copy strings: “Let’s build”, “Let’s automate”, “Review changes”, “Hold tight…”.
