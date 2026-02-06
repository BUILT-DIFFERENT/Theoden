import { isTauri as detectTauri } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __THEODEN_APP_SERVER_STARTED__?: boolean;
  }
}

export function isTauri() {
  return detectTauri();
}
