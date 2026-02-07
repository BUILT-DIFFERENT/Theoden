# 07 - Worker Architecture

## Entry behavior

`worker.js` runs in a Node worker thread and requires `parentPort`.

Startup:

1. Initializes sentry/telemetry with worker metadata (`workerId`, build/session info).
2. Creates worker-local app event emitter and handler service.
3. Bridges responses to parent with `parentPort.postMessage({...workerId})`.

## Parent/worker message contract

Inbound from parent includes:

- `worker-sentry-user-update`
- `worker-app-event`
- `worker-request`
- `worker-request-cancel`

Outbound to parent uses worker-tagged payloads and includes request lifecycle responses.

## Role in overall architecture

Workers act as isolated service executors under host control while still using central telemetry and shared auth user propagation.
