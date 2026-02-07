# 15 - Notifications, Focus, And Window State

## Desktop notification flow

Renderer -> host:

- `desktop-notification-show`
- `desktop-notification-hide`

Host -> renderer:

- `desktop-notification-action`

## Focus-aware suppression behavior

Main and renderer logic both include focus/active-conversation checks to avoid noisy notifications for already-focused threads.

Related focus messages:

- renderer dispatch: `electron-window-focus-request`, `view-focused`
- host response: `electron-window-focus-changed`

## Window mode transitions

Host handles primary window mode changes (`onboarding` vs normal) by mutating:

- size/resizable/maximizable/fullscreen constraints
- restore bounds state

This is central to onboarding-specific shell behavior.
