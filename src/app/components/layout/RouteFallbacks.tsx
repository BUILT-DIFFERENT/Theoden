export function RouteErrorFallback({ error }: { error: Error }) {
  return (
    <div className="surface-panel mx-auto max-w-2xl px-5 py-6 text-sm text-ink-200">
      <p className="text-xs uppercase tracking-[0.2em] text-rose-300">
        Route error
      </p>
      <p className="mt-2 text-xs text-ink-400">{error.message}</p>
    </div>
  );
}

export function RoutePendingFallback() {
  return (
    <div className="surface-panel mx-auto max-w-2xl px-5 py-6 text-sm text-ink-200">
      Loading route…
    </div>
  );
}
