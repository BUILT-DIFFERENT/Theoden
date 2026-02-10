use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};

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

pub struct AppServerBridge {
    writer: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>,
    kill_signal: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    running: Arc<AtomicBool>,
    notification_tx: broadcast::Sender<serde_json::Value>,
}

impl Default for AppServerBridge {
    fn default() -> Self {
        let (notification_tx, _) = broadcast::channel(512);
        Self {
            writer: Arc::new(Mutex::new(None)),
            pending: Arc::new(Mutex::new(HashMap::new())),
            kill_signal: Arc::new(Mutex::new(None)),
            running: Arc::new(AtomicBool::new(false)),
            notification_tx,
        }
    }
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
        if self.running.load(Ordering::Acquire) {
            return Ok(());
        }
        if self.running.swap(true, Ordering::AcqRel) {
            return Ok(());
        }

        let mut child = match (|| -> Result<tokio::process::Child, String> {
            let codex_command = resolve_codex_cli_command()?;
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
            cmd.spawn()
                .map_err(|err| format!("failed to spawn codex app-server: {err}"))
        })() {
            Ok(child) => child,
            Err(error) => {
                self.running.store(false, Ordering::Release);
                return Err(error);
            }
        };

        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                self.running.store(false, Ordering::Release);
                return Err("failed to capture app-server stdout".to_string());
            }
        };
        let stderr = match child.stderr.take() {
            Some(stderr) => stderr,
            None => {
                self.running.store(false, Ordering::Release);
                return Err("failed to capture app-server stderr".to_string());
            }
        };
        let mut stdin = match child.stdin.take() {
            Some(stdin) => stdin,
            None => {
                self.running.store(false, Ordering::Release);
                return Err("failed to capture app-server stdin".to_string());
            }
        };

        let (writer_tx, mut writer_rx) = mpsc::channel::<String>(256);
        *self.writer.lock().await = Some(writer_tx);

        let (kill_tx, mut kill_rx) = oneshot::channel();
        *self.kill_signal.lock().await = Some(kill_tx);

        let bridge = self.clone_for_tasks();
        let app_handle = app.clone();
        let notification_tx = self.notification_tx.clone();
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
                            let _ = app_handle.emit("app-server-notification", message.clone());
                            if !has_id {
                                let _ = notification_tx.send(message);
                            }
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

        let app_handle = app.clone();
        tokio::spawn(async move {
            while let Some(line) = writer_rx.recv().await {
                if let Err(err) = stdin.write_all(line.as_bytes()).await {
                    let _ = app_handle.emit(
                        "app-server-stderr",
                        serde_json::json!({ "stderr": format!("failed to write app-server stdin: {err}") }),
                    );
                    break;
                }
                if let Err(err) = stdin.write_all(b"\n").await {
                    let _ = app_handle.emit(
                        "app-server-stderr",
                        serde_json::json!({ "stderr": format!("failed to terminate app-server stdin line: {err}") }),
                    );
                    break;
                }
            }
        });

        let bridge = self.clone_for_tasks();
        let app_handle = app.clone();
        tokio::spawn(async move {
            let result = tokio::select! {
                wait_result = child.wait() => wait_result,
                _ = &mut kill_rx => {
                    let _ = child.kill().await;
                    child.wait().await
                }
            };

            let payload = match result {
                Ok(status) => serde_json::json!({
                    "code": status.code(),
                    "success": status.success(),
                }),
                Err(err) => serde_json::json!({
                    "error": format!("failed to observe app-server status: {err}"),
                }),
            };

            bridge.reset_runtime().await;
            let _ = app_handle.emit(APP_SERVER_EXIT_EVENT, payload);
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
        if let Err(err) = self.send_line(payload).await {
            self.pending.lock().await.remove(&id_value);
            return Err(err);
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
        if let Some(stop_tx) = self.kill_signal.lock().await.take() {
            let _ = stop_tx.send(());
        } else {
            self.running.store(false, Ordering::Release);
        }
        self.pending.lock().await.clear();
        *self.writer.lock().await = None;
        Ok(())
    }

    pub fn subscribe_notifications(&self) -> broadcast::Receiver<serde_json::Value> {
        self.notification_tx.subscribe()
    }

    async fn write_line(&self, payload: serde_json::Value) -> Result<(), String> {
        let line = serde_json::to_string(&payload).map_err(|err| err.to_string())?;
        self.send_line(line).await
    }

    async fn send_line(&self, line: String) -> Result<(), String> {
        let sender = self
            .writer
            .lock()
            .await
            .clone()
            .ok_or_else(|| "app-server stdin not available".to_string())?;
        sender
            .send(line)
            .await
            .map_err(|_| "app-server stdin not available".to_string())
    }

    fn clone_for_tasks(&self) -> AppServerBridgeTaskHandle {
        AppServerBridgeTaskHandle {
            writer: self.writer.clone(),
            pending: self.pending.clone(),
            kill_signal: self.kill_signal.clone(),
            running: self.running.clone(),
        }
    }
}

struct AppServerBridgeTaskHandle {
    writer: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>,
    kill_signal: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    running: Arc<AtomicBool>,
}

impl AppServerBridgeTaskHandle {
    async fn reset_runtime(&self) {
        *self.writer.lock().await = None;
        *self.kill_signal.lock().await = None;
        self.pending.lock().await.clear();
        self.running.store(false, Ordering::Release);
    }
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
