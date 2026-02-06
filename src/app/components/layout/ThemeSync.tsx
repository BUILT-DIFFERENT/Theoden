import { useEffect } from "react";

import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";

export function ThemeSync() {
  const settings = useRuntimeSettings();

  useEffect(() => {
    const html = document.documentElement;
    const applyTheme = () => {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const resolvedTheme =
        settings.theme === "system"
          ? prefersDark
            ? "dark"
            : "light"
          : settings.theme;
      html.dataset.theme = resolvedTheme;
      html.dataset.themePreference = settings.theme;
      html.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    if (settings.theme !== "system") {
      return;
    }
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    colorSchemeQuery.addEventListener("change", applyTheme);
    return () => colorSchemeQuery.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  return null;
}
