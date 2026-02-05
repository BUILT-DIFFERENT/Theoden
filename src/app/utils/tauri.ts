declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __THEODEN_APP_SERVER_STARTED__?: boolean;
  }
}

export function isTauri() {
  return (
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
}
