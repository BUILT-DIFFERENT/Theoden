#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

#[derive(Debug, Serialize, Deserialize)]
struct ConfigPayload {
    model: Option<String>,
    effort: Option<String>,
    verbosity: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CliRunResult {
    code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Default)]
struct AppServerBridge {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    pending: Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>,
}

impl AppServerBridge {
    fn new() -> Self {
        Self::default()
    }
}

#[tauri::command]
fn load_config() -> ConfigPayload {
    ConfigPayload {
        model: Some("gpt-5".to_string()),
        effort: Some("high".to_string()),
        verbosity: Some("normal".to_string()),
    }
}

#[tauri::command]
fn list_threads() -> Vec<String> {
    Vec::new()
}

#[tauri::command]
fn start_run(_prompt: String) -> Result<String, String> {
    Ok("run-stub".to_string())
}

#[tauri::command]
async fn app_server_start(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppServerBridge>>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
) -> Result<(), String> {
    let mut child_guard = state.child.lock().await;
    if child_guard.is_some() {
        return Ok(());
    }

    let mut cmd = Command::new("codex");
    cmd.arg("app-server");
    if let Some(extra_args) = args {
        cmd.args(extra_args);
    }
    if let Some(cwd) = cwd {
        cmd.current_dir(cwd);
    }
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|err| format!("failed to spawn codex app-server: {err}"))?;
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

    *state.stdin.lock().await = Some(stdin);

    let bridge = Arc::clone(state.inner());
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
                        let id_value = message.get("id");
                        if let Some(key) = id_value.and_then(id_to_string) {
                            if let Some(tx) = bridge.pending.lock().await.remove(&key) {
                                let _ = tx.send(message);
                                continue;
                            }
                        }
                        if has_method {
                            let _ = app_handle.emit_all("app-server-request", message);
                            continue;
                        }
                    }

                    if has_method {
                        let _ = app_handle.emit_all("app-server-notification", message);
                    } else {
                        let _ = app_handle.emit_all("app-server-response", message);
                    }
                }
                Err(err) => {
                    let payload = serde_json::json!({
                        "type": "parse_error",
                        "error": err.to_string(),
                        "line": line
                    });
                    let _ = app_handle.emit_all("app-server-raw", payload);
                }
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
            let _ = app_handle.emit_all("app-server-stderr", payload);
        }
    });

    *child_guard = Some(child);
    Ok(())
}

#[tauri::command]
async fn app_server_request(
    state: tauri::State<'_, Arc<AppServerBridge>>,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id_value = request
        .get("id")
        .and_then(id_to_string)
        .ok_or_else(|| "request must include an id".to_string())?;
    let (tx, rx) = oneshot::channel();
    state.pending.lock().await.insert(id_value.clone(), tx);

    let payload = serde_json::to_string(&request).map_err(|err| err.to_string())?;
    let mut stdin_guard = state.stdin.lock().await;
    let stdin = stdin_guard
        .as_mut()
        .ok_or_else(|| "app-server stdin not available".to_string())?;
    if let Err(err) = stdin.write_all(payload.as_bytes()).await {
        state.pending.lock().await.remove(&id_value);
        return Err(err.to_string());
    }
    if let Err(err) = stdin.write_all(b"\n").await {
        state.pending.lock().await.remove(&id_value);
        return Err(err.to_string());
    }

    match tokio::time::timeout(Duration::from_secs(60), rx).await {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(_)) => {
            state.pending.lock().await.remove(&id_value);
            Err("app-server response channel closed".to_string())
        }
        Err(_) => {
            state.pending.lock().await.remove(&id_value);
            Err("app-server request timed out".to_string())
        }
    }
}

#[tauri::command]
async fn app_server_notify(
    state: tauri::State<'_, Arc<AppServerBridge>>,
    method: String,
    params: Option<serde_json::Value>,
) -> Result<(), String> {
    let payload = serde_json::json!({ "method": method, "params": params });
    let line = serde_json::to_string(&payload).map_err(|err| err.to_string())?;
    let mut stdin_guard = state.stdin.lock().await;
    let stdin = stdin_guard
        .as_mut()
        .ok_or_else(|| "app-server stdin not available".to_string())?;
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|err| err.to_string())?;
    stdin.write_all(b"\n").await.map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
async fn app_server_respond(
    state: tauri::State<'_, Arc<AppServerBridge>>,
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
    let line = serde_json::to_string(&payload).map_err(|err| err.to_string())?;
    let mut stdin_guard = state.stdin.lock().await;
    let stdin = stdin_guard
        .as_mut()
        .ok_or_else(|| "app-server stdin not available".to_string())?;
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|err| err.to_string())?;
    stdin.write_all(b"\n").await.map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
async fn app_server_stop(state: tauri::State<'_, Arc<AppServerBridge>>) -> Result<(), String> {
    if let Some(mut child) = state.child.lock().await.take() {
        let _ = child.kill().await;
    }
    state.pending.lock().await.clear();
    *state.stdin.lock().await = None;
    Ok(())
}

#[tauri::command]
fn run_cli(
    _args: Vec<String>,
    _cwd: Option<String>,
    _env: Option<HashMap<String, String>>,
) -> Result<CliRunResult, String> {
    // Placeholder: execute `codex` CLI with args and working directory.
    Err("run_cli not implemented yet".to_string())
}

fn id_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(AppServerBridge::new()))
        .invoke_handler(tauri::generate_handler![
            load_config,
            list_threads,
            start_run,
            app_server_start,
            app_server_request,
            app_server_notify,
            app_server_respond,
            app_server_stop,
            run_cli
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
