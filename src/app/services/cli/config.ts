export interface CodexConfig {
  model?: string;
  effort?: "medium" | "high" | "extra_high";
  verbosity?: "quiet" | "normal" | "verbose";
  [key: string]: unknown;
}

export async function loadMergedConfig(): Promise<CodexConfig> {
  // Placeholder: call `config/read` via app-server.
  return {
    model: "gpt-5",
    effort: "high",
    verbosity: "normal"
  };
}

export async function validateConfig(_configText: string): Promise<{ valid: boolean; errors: string[] }> {
  // Placeholder: app-server validates on write; UI can do local TOML parse.
  return { valid: true, errors: [] };
}
