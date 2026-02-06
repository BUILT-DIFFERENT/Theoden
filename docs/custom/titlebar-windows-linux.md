# Windows/Linux Integrated Titlebar

This app uses a custom integrated titlebar/menubar on Windows and Linux.

## Behavior

- Native Tauri app menu is disabled for desktop runtime.
- The top strip is rendered in React (`WindowTitlebar`) and includes:
  - File/Edit/View/Window/Help menu groups
  - window controls (minimize, maximize/restore, close)
  - draggable spacer regions via `data-tauri-drag-region`
- Windows uses `tauri-plugin-decorum` to improve overlay/snap integration.

## Required Permissions

`src-tauri/capabilities/default.json` must include:

- `core:window:allow-start-dragging`
- `core:window:allow-minimize`
- `core:window:allow-toggle-maximize`
- `core:window:allow-close`
- `decorum:allow-create-overlay-titlebar`
- `decorum:allow-show-snap-overlay`

## Troubleshooting

- If drag stops working, verify only non-interactive spacer regions carry `data-tauri-drag-region`.
- If minimize/maximize/close fail, check window permissions in `src-tauri/capabilities/default.json`.
- If Windows snap behavior regresses, validate `tauri-plugin-decorum` is initialized in `src-tauri/src/main.rs`.
