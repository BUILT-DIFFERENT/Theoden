# Product Philosophy

The product is fundamentally different from an IDE. It is a command center for agentic work. The user manages outcomes and threads, not files and keystrokes.

## Core stance

- This app is manager-first, not editor-first.
- Threads are the primary artifact, not files.
- The main view is a run timeline, not a code editor.
- Editing is optional and handled in the user’s editor of choice.

## Consequences for UX

- Show status, plans, and results as the primary surface.
- Make parallel runs the headline feature, not a bonus.
- Make long-running, high-confidence runs feel normal with progress signals.

## Shared world with the CLI

- Desktop reads and writes the same config and history as the CLI.
- Threads created here should be resumable by the CLI.
- The UI must never invent a separate world.

## Non-goals

- Replace VS Code or JetBrains.
- Become a terminal emulator.
- Hide the underlying git workflows.
