export const codexIconAssets = {
  logo: new URL("./codex/codex-logo.png", import.meta.url).href,
  appIcon: new URL("./codex/codex-app-icon.png", import.meta.url).href,
  appIconIco: new URL("./codex/codex-app-icon.ico", import.meta.url).href,
} as const;

export const openInAppIconAssets = {
  "android-studio": new URL("./apps/android-studio.png", import.meta.url).href,
  "antigravity": new URL("./apps/antigravity.png", import.meta.url).href,
  "bbedit": new URL("./apps/bbedit.png", import.meta.url).href,
  "cursor": new URL("./apps/cursor.png", import.meta.url).href,
  "finder": new URL("./apps/finder.png", import.meta.url).href,
  "ghostty": new URL("./apps/ghostty.png", import.meta.url).href,
  "goland": new URL("./apps/goland.png", import.meta.url).href,
  "intellij": new URL("./apps/intellij.png", import.meta.url).href,
  "iterm2": new URL("./apps/iterm2.png", import.meta.url).href,
  "pycharm": new URL("./apps/pycharm.png", import.meta.url).href,
  "rustrover": new URL("./apps/rustrover.png", import.meta.url).href,
  "terminal": new URL("./apps/terminal.png", import.meta.url).href,
  "textmate": new URL("./apps/textmate.png", import.meta.url).href,
  "vscode-insiders": new URL("./apps/vscode-insiders.png", import.meta.url)
    .href,
  "vscode": new URL("./apps/vscode.png", import.meta.url).href,
  "warp": new URL("./apps/warp.png", import.meta.url).href,
  "webstorm": new URL("./apps/webstorm.svg", import.meta.url).href,
  "windsurf": new URL("./apps/windsurf.png", import.meta.url).href,
  "xcode": new URL("./apps/xcode.png", import.meta.url).href,
  "zed": new URL("./apps/zed.png", import.meta.url).href,
} as const;

export type OpenInAppIconId = keyof typeof openInAppIconAssets;

export const editorIconById = {
  vscode: openInAppIconAssets.vscode,
  intellij: openInAppIconAssets.intellij,
  webstorm: openInAppIconAssets.webstorm,
} as const;
