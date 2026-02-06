#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::menu::{
    AboutMetadataBuilder, Menu, MenuBuilder, MenuItem, SubmenuBuilder, HELP_SUBMENU_ID,
    WINDOW_SUBMENU_ID,
};
use tauri::{AppHandle, Emitter};
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

const MENU_COMMAND_EVENT: &str = "codex-menu-command";
const APP_SERVER_EXIT_EVENT: &str = "app-server-exit";
const APP_SERVER_TIMEOUT_EVENT: &str = "app-server-timeout";
const MENU_NEW_THREAD_ID: &str = "codex.menu.new-thread";
const MENU_AUTOMATIONS_ID: &str = "codex.menu.automations";
const MENU_SKILLS_ID: &str = "codex.menu.skills";
const MENU_SETTINGS_ID: &str = "codex.menu.settings";
const MENU_RELOAD_UI_ID: &str = "codex.menu.reload-ui";
const MENU_TOGGLE_TERMINAL_ID: &str = "codex.menu.toggle-terminal";
const MENU_TOGGLE_REVIEW_PANEL_ID: &str = "codex.menu.toggle-review-panel";
const MENU_OPEN_DOCS_ID: &str = "codex.menu.open-docs";

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
    let (stdout, stderr, stdin) = {
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

    let bridge = Arc::clone(state.inner());
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

#[tauri::command]
async fn app_server_request(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppServerBridge>>,
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
            let payload = serde_json::json!({
                "id": id_value,
                "method": method,
            });
            let _ = app.emit(APP_SERVER_TIMEOUT_EVENT, payload);
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
    stdin
        .write_all(b"\n")
        .await
        .map_err(|err| err.to_string())?;
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
    stdin
        .write_all(b"\n")
        .await
        .map_err(|err| err.to_string())?;
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
async fn run_cli(
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<CliRunResult, String> {
    let mut cmd = Command::new("codex");
    cmd.args(args);
    if let Some(cwd) = cwd {
        cmd.current_dir(cwd);
    }
    if let Some(env) = env {
        cmd.envs(env);
    }
    let output = cmd
        .output()
        .await
        .map_err(|err| format!("failed to run codex CLI: {err}"))?;
    Ok(CliRunResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

#[tauri::command]
async fn git_apply_patch(
    cwd: String,
    patch: String,
    cached: bool,
    reverse: bool,
) -> Result<CliRunResult, String> {
    let mut cmd = Command::new("git");
    cmd.arg("apply").arg("--unidiff-zero");
    if cached {
        cmd.arg("--cached");
    }
    if reverse {
        cmd.arg("-R");
    }
    cmd.current_dir(cwd);
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|err| format!("failed to spawn git apply: {err}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "failed to capture git apply stdin".to_string())?;
    stdin
        .write_all(patch.as_bytes())
        .await
        .map_err(|err| format!("failed to write patch to git apply stdin: {err}"))?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .await
        .map_err(|err| format!("failed to wait for git apply: {err}"))?;
    Ok(CliRunResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn id_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn build_app_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let new_thread = MenuItem::with_id(
        app,
        MENU_NEW_THREAD_ID,
        "New Thread",
        true,
        Some("CmdOrCtrl+N"),
    )?;
    let automations = MenuItem::with_id(
        app,
        MENU_AUTOMATIONS_ID,
        "Automations",
        true,
        Some("CmdOrCtrl+Shift+A"),
    )?;
    let skills = MenuItem::with_id(
        app,
        MENU_SKILLS_ID,
        "Skills",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let settings = MenuItem::with_id(
        app,
        MENU_SETTINGS_ID,
        "Settings",
        true,
        Some("CmdOrCtrl+Comma"),
    )?;
    let reload_ui = MenuItem::with_id(
        app,
        MENU_RELOAD_UI_ID,
        "Reload UI",
        true,
        Some("CmdOrCtrl+R"),
    )?;
    let toggle_terminal = MenuItem::with_id(
        app,
        MENU_TOGGLE_TERMINAL_ID,
        "Toggle Terminal",
        true,
        Some("CmdOrCtrl+J"),
    )?;
    let toggle_review_panel = MenuItem::with_id(
        app,
        MENU_TOGGLE_REVIEW_PANEL_ID,
        "Toggle Review Panel",
        true,
        Some("CmdOrCtrl+Shift+R"),
    )?;
    let open_docs = MenuItem::with_id(app, MENU_OPEN_DOCS_ID, "Codex Docs", true, Some("F1"))?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_thread)
        .item(&automations)
        .item(&skills)
        .separator()
        .item(&settings)
        .separator()
        .close_window()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&reload_ui)
        .item(&toggle_terminal)
        .item(&toggle_review_panel)
        .build()?;

    let window_menu = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Codex"))
        .version(Some("0.1.0"))
        .build();
    let help_menu = SubmenuBuilder::with_id(app, HELP_SUBMENU_ID, "Help")
        .item(&open_docs)
        .separator()
        .about(Some(about_metadata))
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

fn route_menu_command<R: tauri::Runtime>(app: &AppHandle<R>, menu_id: &str) {
    let command = match menu_id {
        MENU_NEW_THREAD_ID => Some("new-thread"),
        MENU_AUTOMATIONS_ID => Some("open-automations"),
        MENU_SKILLS_ID => Some("open-skills"),
        MENU_SETTINGS_ID => Some("open-settings"),
        MENU_RELOAD_UI_ID => Some("reload-ui"),
        MENU_TOGGLE_TERMINAL_ID => Some("toggle-terminal"),
        MENU_TOGGLE_REVIEW_PANEL_ID => Some("toggle-review-panel"),
        MENU_OPEN_DOCS_ID => Some("open-docs"),
        _ => None,
    };

    if let Some(command) = command {
        if let Err(error) = app.emit(MENU_COMMAND_EVENT, command) {
            eprintln!("failed to emit {MENU_COMMAND_EVENT} for {menu_id}: {error}");
        }
    }
}

fn main() {
    tauri::Builder::default()
        .menu(|app| build_app_menu(app))
        .on_menu_event(|app, event| {
            route_menu_command(app, event.id().as_ref());
        })
        .plugin(tauri_plugin_dialog::init())
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
            run_cli,
            git_apply_patch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
