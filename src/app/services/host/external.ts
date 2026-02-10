import { invoke } from "@tauri-apps/api/core";

import { isTauri } from "@/app/utils/tauri";

function normalizeExternalUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("mailto:")) {
    return url;
  }
  return null;
}

export async function openExternalUrl(rawUrl: string) {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) {
    throw new Error("Unsupported external URL.");
  }

  if (isTauri()) {
    try {
      await invoke("host_open_external_url", { url: normalized });
      return;
    } catch (error) {
      console.warn("Failed to open URL through host bridge", error);
    }
  }

  if (typeof window !== "undefined") {
    window.open(normalized, "_blank", "noopener,noreferrer");
    return;
  }

  throw new Error("No browser context available for external URL.");
}
