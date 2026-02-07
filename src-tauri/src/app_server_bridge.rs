use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub const APP_SERVER_EXIT_EVENT: &str = "app-server-exit";
pub const APP_SERVER_TIMEOUT_EVENT: &str = "app-server-timeout";

#[derive(Debug, Serialize, Deserialize)]
pub struct CliRunResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Default)]
pub struct AppServerBridge {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>,
}

pub struct CodexCliCommand {
    pub program: PathBuf,
    pub prepended_path_entries: Vec<PathBuf>,
}

impl AppServerBridge {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn start(
        &self,
        app: AppHandle,
        args: Option<Vec<String>>,
        cwd: Option<String>,
    ) -> Result<(), String> {
        let (stdout, stderr, stdin) = {
            let codex_command = resolve_codex_cli_command()?;
            let mut child_guard = self.child.lock().await;
            if child_guard.is_some() {
                return Ok(());
            }

            let mut cmd = Command::new(codex_command.program);
            configure_command_for_desktop(&mut cmd);
            cmd.arg("app-server");
            apply_cli_path_to_command(&mut cmd, &codex_command.prepended_path_entries, None);
            if let Some(extra_args) = args {
                cmd.args(extra_args);
            }
            if let Some(cwd) = cwd {
                cmd.current_dir(cwd);
            }
            cmd.stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());

            let mut child = cmd
                .spawn()
                .map_err(|err| format!("failed to spawn codex app-server: {err}"))?;
            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| "failed to capture app-server stdout".to_string())?;
            let stderr = child
                .stderr
                .take()
                .ok_or_else(|| "failed to capture app-server stderr".to_string())?;
            let stdin = child
                .stdin
                .take()
                .ok_or_else(|| "failed to capture app-server stdin".to_string())?;

            *child_guard = Some(child);
            (stdout, stderr, stdin)
        };

        *self.stdin.lock().await = Some(stdin);

        let bridge = self.clone_for_tasks();
        let app_handle = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                match serde_json::from_str::<serde_json::Value>(&line) {
                    Ok(message) => {
                        let has_id = message.get("id").is_some();
                        let has_method = message.get("method").is_some();

                        if has_id {
                            if let Some(key) = message.get("id").and_then(id_to_string) {
                                if let Some(tx) = bridge.pending.lock().await.remove(&key) {
                                    let _ = tx.send(message);
                                    continue;
                                }
                            }
                            if has_method {
                                let _ = app_handle.emit("app-server-request", message);
                                continue;
                            }
                        }

                        if has_method {
                            let _ = app_handle.emit("app-server-notification", message);
                        } else {
                            let _ = app_handle.emit("app-server-response", message);
                        }
                    }
                    Err(err) => {
                        let payload = serde_json::json!({
                            "type": "parse_error",
                            "error": err.to_string(),
                            "line": line
                        });
                        let _ = app_handle.emit("app-server-raw", payload);
                    }
                }
            }
        });

        let bridge = self.clone_for_tasks();
        let app_handle = app.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;
                let mut exit_payload: Option<serde_json::Value> = None;
                {
                    let mut child_guard = bridge.child.lock().await;
                    let Some(child) = child_guard.as_mut() else {
                        break;
                    };
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            let payload = serde_json::json!({
                                "code": status.code(),
                                "success": status.success(),
                            });
                            *child_guard = None;
                            exit_payload = Some(payload);
                        }
                        Ok(None) => {}
                        Err(err) => {
                            let payload = serde_json::json!({
                                "error": format!("failed to observe app-server status: {err}"),
                            });
                            *child_guard = None;
                            exit_payload = Some(payload);
                        }
                    }
                }

                if let Some(payload) = exit_payload {
                    *bridge.stdin.lock().await = None;
                    bridge.pending.lock().await.clear();
                    let _ = app_handle.emit(APP_SERVER_EXIT_EVENT, payload);
                    break;
                }
            }
        });

        let app_handle = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                let payload = serde_json::json!({ "stderr": line });
                let _ = app_handle.emit("app-server-stderr", payload);
            }
        });
        Ok(())
    }

    pub async fn request(
        &self,
        app: AppHandle,
        request: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let method = request
            .get("method")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let id_value = request
            .get("id")
            .and_then(id_to_string)
            .ok_or_else(|| "request must include an id".to_string())?;
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id_value.clone(), tx);

        let payload = serde_json::to_string(&request).map_err(|err| err.to_string())?;
        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard
            .as_mut()
            .ok_or_else(|| "app-server stdin not available".to_string())?;
        if let Err(err) = stdin.write_all(payload.as_bytes()).await {
            self.pending.lock().await.remove(&id_value);
            return Err(err.to_string());
        }
        if let Err(err) = stdin.write_all(b"\n").await {
            self.pending.lock().await.remove(&id_value);
            return Err(err.to_string());
        }

        match tokio::time::timeout(Duration::from_secs(60), rx).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => {
                self.pending.lock().await.remove(&id_value);
                Err("app-server response channel closed".to_string())
            }
            Err(_) => {
                self.pending.lock().await.remove(&id_value);
                let payload = serde_json::json!({
                    "id": id_value,
                    "method": method,
                });
                let _ = app.emit(APP_SERVER_TIMEOUT_EVENT, payload);
                Err("app-server request timed out".to_string())
            }
        }
    }

    pub async fn notify(
        &self,
        method: String,
        params: Option<serde_json::Value>,
    ) -> Result<(), String> {
        let payload = serde_json::json!({ "method": method, "params": params });
        self.write_line(payload).await
    }

    pub async fn respond(
        &self,
        id: serde_json::Value,
        result: Option<serde_json::Value>,
        error: Option<serde_json::Value>,
    ) -> Result<(), String> {
        let mut payload = serde_json::json!({ "id": id });
        if let Some(result) = result {
            payload["result"] = result;
        } else if let Some(error) = error {
            payload["error"] = error;
        } else {
            payload["result"] = serde_json::json!({});
        }
        self.write_line(payload).await
    }

    pub async fn stop(&self) -> Result<(), String> {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
        self.pending.lock().await.clear();
        *self.stdin.lock().await = None;
        Ok(())
    }

    async fn write_line(&self, payload: serde_json::Value) -> Result<(), String> {
        let line = serde_json::to_string(&payload).map_err(|err| err.to_string())?;
        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard
            .as_mut()
            .ok_or_else(|| "app-server stdin not available".to_string())?;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|err| err.to_string())?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn clone_for_tasks(&self) -> AppServerBridgeTaskHandle {
        AppServerBridgeTaskHandle {
            child: self.child.clone(),
            stdin: self.stdin.clone(),
            pending: self.pending.clone(),
        }
    }
}

struct AppServerBridgeTaskHandle {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>,
}

fn normalize_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn paths_match(a: &Path, b: &Path) -> bool {
    let normalized_a = normalize_path(a);
    let normalized_b = normalize_path(b);
    if cfg!(windows) {
        normalized_a
            .to_string_lossy()
            .eq_ignore_ascii_case(&normalized_b.to_string_lossy())
    } else {
        normalized_a == normalized_b
    }
}

pub fn configure_command_for_desktop(command: &mut Command) {
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn codex_vendor_target_triple() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        ("windows", "aarch64") => Some("aarch64-pc-windows-msvc"),
        ("linux", "x86_64") => Some("x86_64-unknown-linux-musl"),
        ("linux", "aarch64") => Some("aarch64-unknown-linux-musl"),
        ("android", "x86_64") => Some("x86_64-unknown-linux-musl"),
        ("android", "aarch64") => Some("aarch64-unknown-linux-musl"),
        ("macos", "x86_64") => Some("x86_64-apple-darwin"),
        ("macos", "aarch64") => Some("aarch64-apple-darwin"),
        _ => None,
    }
}

fn codex_vendor_command_from_root(vendor_root: &Path) -> Option<CodexCliCommand> {
    let target_triple = codex_vendor_target_triple()?;
    let target_root = vendor_root.join(target_triple);
    let binary_name = if cfg!(windows) { "codex.exe" } else { "codex" };
    let native_binary = target_root.join("codex").join(binary_name);
    if !native_binary.exists() {
        return None;
    }

    let mut prepended_path_entries = Vec::new();
    let path_dir = target_root.join("path");
    if path_dir.exists() {
        prepended_path_entries.push(path_dir);
    }

    Some(CodexCliCommand {
        program: native_binary,
        prepended_path_entries,
    })
}

fn resolve_codex_from_npm_shim(codex_path: &Path) -> Option<CodexCliCommand> {
    let extension = codex_path.extension().and_then(OsStr::to_str)?;
    if !extension.eq_ignore_ascii_case("cmd") && !extension.eq_ignore_ascii_case("bat") {
        return None;
    }

    let shim_dir = codex_path.parent()?;
    let vendor_root = shim_dir
        .join("node_modules")
        .join("@openai")
        .join("codex")
        .join("vendor");
    codex_vendor_command_from_root(&vendor_root)
}

#[cfg(windows)]
fn resolve_codex_from_windows_appdata() -> Option<CodexCliCommand> {
    let app_data = std::env::var_os("APPDATA")?;
    let vendor_root = PathBuf::from(app_data)
        .join("npm")
        .join("node_modules")
        .join("@openai")
        .join("codex")
        .join("vendor");
    codex_vendor_command_from_root(&vendor_root)
}

pub fn build_prepended_path(
    prepended_path_entries: &[PathBuf],
    base_path: Option<OsString>,
) -> Option<OsString> {
    if prepended_path_entries.is_empty() {
        return None;
    }

    let mut path_entries = prepended_path_entries.to_vec();
    if let Some(path) = base_path.or_else(|| std::env::var_os("PATH")) {
        path_entries.extend(std::env::split_paths(&path));
    }
    std::env::join_paths(path_entries).ok()
}

pub fn apply_cli_path_to_command(
    command: &mut Command,
    prepended_path_entries: &[PathBuf],
    base_path: Option<OsString>,
) {
    if let Some(path) = build_prepended_path(prepended_path_entries, base_path) {
        command.env("PATH", path);
    }
}

pub fn resolve_codex_cli_command() -> Result<CodexCliCommand, String> {
    let current_exe = std::env::current_exe()
        .map_err(|err| format!("failed to resolve current executable path: {err}"))?;
    let mut candidate_commands = Vec::new();

    if let Ok(discovered_codex_path) = which::which("codex") {
        let command =
            resolve_codex_from_npm_shim(&discovered_codex_path).unwrap_or(CodexCliCommand {
                program: discovered_codex_path,
                prepended_path_entries: Vec::new(),
            });
        candidate_commands.push(command);
    }

    #[cfg(windows)]
    if let Some(app_data_command) = resolve_codex_from_windows_appdata() {
        candidate_commands.push(app_data_command);
    }

    for candidate in candidate_commands {
        if !paths_match(&current_exe, &candidate.program) {
            return Ok(candidate);
        }
    }

    Err(
        "failed to resolve a runnable `codex` CLI for desktop bridge; install Codex CLI and ensure it is available on PATH or under %APPDATA%\\npm\\node_modules\\@openai\\codex"
            .to_string(),
    )
}

fn id_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}
