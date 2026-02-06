import { useEffect, useMemo, useState } from "react";

import {
  loadStoredSettings,
  subscribeSettingsUpdates,
  type StoredSettingsSnapshot,
} from "@/app/state/settings";
import { mockEditors } from "@/app/state/settingsData";

function defaultOpenDestination() {
  return (
    mockEditors.find((editor) => editor.detected)?.id ??
    mockEditors[0]?.id ??
    "vscode"
  );
}

export function useRuntimeSettings() {
  const preferredOpenDestination = useMemo(defaultOpenDestination, []);
  const [settings, setSettings] = useState<StoredSettingsSnapshot>(() =>
    loadStoredSettings(preferredOpenDestination),
  );

  useEffect(() => {
    setSettings(loadStoredSettings(preferredOpenDestination));
    return subscribeSettingsUpdates((nextSettings) => {
      if (nextSettings) {
        setSettings(nextSettings);
        return;
      }
      setSettings(loadStoredSettings(preferredOpenDestination));
    });
  }, [preferredOpenDestination]);

  return settings;
}
