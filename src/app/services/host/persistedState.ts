import { invoke } from "@tauri-apps/api/core";

import { isTauri } from "@/app/utils/tauri";

export async function syncPersistedAtom<T>(
  key: string,
  fallback: T,
): Promise<T> {
  if (!isTauri()) {
    return fallback;
  }
  try {
    const value = await invoke<unknown>("persisted_atom_sync", { key });
    if (value == null) {
      return fallback;
    }
    return value as T;
  } catch (error) {
    console.warn(`Failed to sync persisted atom "${key}"`, error);
    return fallback;
  }
}

export async function updatePersistedAtom(key: string, value: unknown) {
  if (!isTauri()) {
    return;
  }
  try {
    await invoke("persisted_atom_update", { key, value });
  } catch (error) {
    console.warn(`Failed to update persisted atom "${key}"`, error);
  }
}

export async function resetPersistedAtom(key: string) {
  if (!isTauri()) {
    return;
  }
  try {
    await invoke("persisted_atom_reset", { key });
  } catch (error) {
    console.warn(`Failed to reset persisted atom "${key}"`, error);
  }
}
