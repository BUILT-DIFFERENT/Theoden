# Worktrees

## Why worktrees

Worktrees allow parallel agents to operate on the same repo without blocking each other. Each thread can live in its own directory and branch while still sharing the same origin.

## Worktree mode UX

- Mode toggle: Local, Worktree, Cloud.
- Worktree mode creates a new workspace directory. In this app, the default strategy is a full clone to a sibling folder rather than `git worktree`.
- Thread shows a clear mapping between thread, worktree path, branch, and PR.

## Merge assistant

- Bring back to main is a guided flow.
- Choose target branch.
- Choose merge strategy: rebase, merge commit, or squash.
- Provide conflict preview and open-in-editor links.

## Clone-based strategy (default)

- Create a new folder by cloning the repo (or copying from a clean baseline).
- Run Codex in that clone and let it create a branch as needed.
- Merge back by adding the clone as a temporary remote or by `git fetch`ing the branch.
- Create or update a branch on the main repo before merging.

## Lifecycle controls

- Clean up worktree after merge.
- Keep for later and pin the worktree.
- Surface stale worktrees in the control room.
