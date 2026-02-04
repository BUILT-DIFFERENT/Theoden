# Features Checklist

This file mirrors the agreed build plan and ensures every requested feature has a spec anchor.

## Philosophy

- Manager-first command center.
- Threads are primary artifacts.
- Run timeline is the main view.
- External editors are first-class.
- App is a CLI wrapper, primarily via `codex app-server`.

## Workflow UI

- Bottom composer to start or append runs.
- Timeline with plans, actions, results.
- Status chips and progress indicators.
- Notifications for done or needs review.

## Project and context

- Multi-project control room sidebar.
- Active runs section across repos.
- Diff and review panel.
- Open in editor and reveal in explorer.

## Commit and PR flow

- One-click commit.
- Auto-generate commit message from staged diff.
- Commit and push, or commit and create PR.

## Worktrees

- Worktree mode with per-thread directory and branch.
- Bring-back merge assistant.
- Clean up or keep worktrees.

## Cloud execution

- Cloud mode in the composer.
- Fire-and-forget runs with PR links.
- Provider interface mirrors local.
- Cloud runs executed via `codex cloud exec`.

## Automations

- Scheduler with enable and disable.
- Prompt templates and variables.
- Automation triggers spawn new threads.

## Skills

- Skills browser with installed and available sections.
- Skill manifests with permissions.
- Yeet skill with end-to-end stage, commit, push, PR flow.
- Remote skill downloads via app-server endpoints.

## Polish

- Unified config and history with CLI.
- Editor detection on startup.
- Attach images to threads.
- Settings view for config and capabilities.
