#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

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
fn app_server_start(_args: Option<Vec<String>>, _cwd: Option<String>) -> Result<(), String> {
    Err("app_server_start not implemented yet".to_string())
}

#[tauri::command]
fn app_server_request(_request: serde_json::Value) -> Result<serde_json::Value, String> {
    Err("app_server_request not implemented yet".to_string())
}

#[tauri::command]
fn app_server_notify(_method: String, _params: Option<serde_json::Value>) -> Result<(), String> {
    Err("app_server_notify not implemented yet".to_string())
}

#[tauri::command]
fn app_server_stop() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn run_cli(
    _args: Vec<String>,
    _cwd: Option<String>,
    _env: Option<std::collections::HashMap<String, String>>,
) -> Result<CliRunResult, String> {
    // Placeholder: execute `codex` CLI with args and working directory.
    Err("run_cli not implemented yet".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            list_threads,
            start_run,
            app_server_start,
            app_server_request,
            app_server_notify,
            app_server_stop,
            run_cli
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
