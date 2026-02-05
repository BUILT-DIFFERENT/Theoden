# Architecture

## Overview

The app is a Tauri desktop shell hosting a React UI. The UI talks to the backend through Tauri commands. The backend wraps the Codex CLI for nearly all functionality (runs, history, config, auth, skills) using `codex app-server` as the primary interface (JSON-RPC over stdio), plus OS integration.

## Layers

- UI layer in `src/app` uses TanStack Router and Query.
- Services in `src/app/services` define provider interfaces that delegate to the app-server bridge.
- Tauri backend in `src-tauri` exposes commands to start the app-server process, send JSON-RPC requests, and surface OS integration.

## Data flow

- UI dispatches a RunRequest to a Provider.
- Provider calls the app-server bridge and subscribes to `turn/*` and `item/*` notifications.
- App-server handshake requires `initialize` then `initialized` before other requests.
- Events append to a timeline and update thread state.
- A run summary and diff snapshot finalize the thread.

## Local vs Worktree vs Cloud

- Local provider wraps `codex app-server` in the current repo context.
- Worktree provider wraps `codex app-server` in a workspace clone (see Worktrees doc).
- Cloud provider uses `codex cloud exec` and maps results into the same thread model.

## Config and history

- Config is read from the shared CLI config.
- History is read from the CLI rollout store via `thread/list` and `thread/read`.
- Desktop writes threads in CLI-compatible format to preserve resumability.
