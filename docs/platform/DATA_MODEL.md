# Data Model

## Thread

- Thread is the primary artifact.
- A thread owns many run events and a final summary.

## Run

- Each run is scoped to a thread and a provider.
- Runs emit a stream of events and conclude with a summary.

## Event

- Events are append-only, timestamped, and ordered.
- The UI treats events as the timeline source of truth.

## Project

- Projects group threads and runs by repo.
- Projects power the control room view.

## Worktree

- Worktrees map to threads in worktree mode.
- Each worktree has a branch and lifecycle status.

## Automation

- Automations define a schedule and a prompt template.
- An automation spawns a new thread when triggered.

## Skill

- Skills are reusable recipes that enrich prompts or run actions.
- Skills expose required permissions and UI fields.
