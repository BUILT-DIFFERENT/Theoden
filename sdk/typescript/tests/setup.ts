import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-sdk-home-"));
process.env.CODEX_HOME = codexHome;

const configPath = path.join(codexHome, "config.toml");
fs.writeFileSync(configPath, "suppress_unstable_features_warning = true\n", "utf8");
