/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_RENDERER_MODE?: "compat" | "rewrite";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
