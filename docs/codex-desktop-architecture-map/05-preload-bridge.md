# 05 - Preload Bridge

## Public surface

`preload.js` exposes:

- `window.codexWindowType`
- `window.electronBridge`

## `electronBridge` methods

- `sendMessageFromView(payload)`
- `getPathForFile(file)`
- `sendWorkerMessageFromView(workerId, payload)`
- `subscribeToWorkerMessages(workerId, callback)`
- `showContextMenu(payload)`
- `triggerSentryTestError()`
- `getSentryInitOptions()`
- `getAppSessionId()`
- `getBuildFlavor()`

## Bridge channels

- Main renderer channels:
  - outbound from renderer: `codex_desktop:message-from-view`
  - inbound to renderer: `codex_desktop:message-for-view`
- Context menu and init channels:
  - `codex_desktop:show-context-menu`
  - `codex_desktop:get-sentry-init-options`
  - `codex_desktop:get-build-flavor`
  - `codex_desktop:trigger-sentry-test`
- Worker channels (templated):
  - `codex_desktop:worker:${id}:from-view`
  - `codex_desktop:worker:${id}:for-view`

## Security posture

- Context isolation is used to expose a narrow API instead of full Node globals.
- Renderer messages are funneled through typed channels and host validation paths.
