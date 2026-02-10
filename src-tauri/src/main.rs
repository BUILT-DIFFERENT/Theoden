#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_server_bridge;
mod automation_store;
mod cloud_host;
mod electron_compat;
mod electron_method_dispatch;
mod git_worker_compat;
mod paths;
mod runtime_contract;
mod state_store;
mod terminal_host;

use app_server_bridge::{
    build_prepended_path, configure_command_for_desktop, resolve_codex_cli_command,
    AppServerBridge, AppServerClientInfo, CliRunResult,
};
use automation_store::{
    now_ts, AutomationCreateParams, AutomationRecord, AutomationRunRecord, AutomationStore,
    AutomationUpdateParams, RunArchiveParams, RunNowParams,
};
use base64::Engine as _;
use cloud_host::{CloudRunCancelParams, CloudRunDescriptor, CloudRunHost, CloudRunStartParams};
use electron_compat::{
    jsonrpc_error, jsonrpc_success, parse_bridge_request_payload, SentryInitOptions, WorkerRequest,
};
use electron_method_dispatch::{
    all_known_methods, dispatch_registry as electron_dispatch_registry,
    is_known_mutation_method as is_known_electron_mutation_method,
    is_known_query_method as is_known_electron_query_method, translated_app_server_method,
};
use git_worker_compat::handle_git_worker;
use paths::codex_home_dir;
use runtime_contract::{
    apply_update_transition, parse_codex_deeplink, BridgeMessageFromViewParams,
    HostBuildFlavorPayload, HostRendererModePayload, HostUpdateStatePayload, HostUpdateTransition,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use state_store::StateStore;
use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
#[cfg(target_os = "windows")]
use tauri_plugin_decorum::WebviewWindowExt;
use terminal_host::{
    TerminalCloseParams, TerminalCreateParams, TerminalHost, TerminalResizeParams,
    TerminalSessionDescriptor, TerminalWriteParams,
};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::sync::Notify;
use uuid::Uuid;
use walkdir::WalkDir;

static REQUEST_NONCE: AtomicU64 = AtomicU64::new(1);
const COMPAT_APP_CHANNEL_FOR_VIEW: &str = "codex_desktop:message-for-view";

struct RuntimeHostState {
    update_state: Mutex<HostUpdateStatePayload>,
}

impl RuntimeHostState {
    fn new() -> Self {
        Self {
            update_state: Mutex::new(HostUpdateStatePayload::default()),
        }
    }
}

fn resolve_renderer_mode() -> String {
    match std::env::var("CODEX_DESKTOP_RENDERER_MODE") {
        Ok(mode) if mode.eq_ignore_ascii_case("rewrite") => "rewrite".to_string(),
        _ => "compat".to_string(),
    }
}

struct ElectronCompatRuntimeState {
    sentry: SentryInitOptions,
    build_flavor: String,
    renderer_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigPayload {
    model: Option<String>,
    effort: Option<String>,
    verbosity: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AutomationRunsListParams {
    automation_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InboxMarkReadParams {
    id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalAttachParams {
    session_id: String,
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
    client_info: Option<AppServerClientInfo>,
) -> Result<(), String> {
    state.ensure_ready(app, args, cwd, client_info).await
}

#[tauri::command]
async fn app_server_request(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppServerBridge>>,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    state.request(app, request).await
}

#[tauri::command]
async fn app_server_notify(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppServerBridge>>,
    method: String,
    params: Option<serde_json::Value>,
) -> Result<(), String> {
    state.notify(app, method, params).await
}

#[tauri::command]
async fn app_server_respond(
    state: tauri::State<'_, Arc<AppServerBridge>>,
    id: serde_json::Value,
    result: Option<serde_json::Value>,
    error: Option<serde_json::Value>,
) -> Result<(), String> {
    state.respond(id, result, error).await
}

#[tauri::command]
async fn app_server_stop(state: tauri::State<'_, Arc<AppServerBridge>>) -> Result<(), String> {
    state.stop().await
}

#[tauri::command]
async fn run_cli(
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<CliRunResult, String> {
    let codex_command = resolve_codex_cli_command()?;
    let mut cmd = Command::new(codex_command.program);
    configure_command_for_desktop(&mut cmd);
    cmd.args(args);
    if let Some(cwd) = cwd {
        cmd.current_dir(cwd);
    }
    let mut merged_env = env.unwrap_or_default();
    let env_path = merged_env.get("PATH").map(OsString::from);
    if let Some(path) = build_prepended_path(&codex_command.prepended_path_entries, env_path) {
        merged_env.insert("PATH".to_string(), path.to_string_lossy().to_string());
    }
    if !merged_env.is_empty() {
        cmd.envs(merged_env);
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
    configure_command_for_desktop(&mut cmd);
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

#[tauri::command]
async fn persisted_atom_sync(
    state_store: tauri::State<'_, Arc<StateStore>>,
    key: String,
) -> Result<serde_json::Value, String> {
    state_store.sync(key).await
}

#[tauri::command]
async fn persisted_atom_update(
    state_store: tauri::State<'_, Arc<StateStore>>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    state_store.update(key, value).await
}

#[tauri::command]
async fn persisted_atom_reset(
    state_store: tauri::State<'_, Arc<StateStore>>,
    key: String,
) -> Result<(), String> {
    state_store.reset(key).await
}

#[tauri::command]
async fn automation_list(
    store: tauri::State<'_, Arc<AutomationStore>>,
) -> Result<Vec<AutomationRecord>, String> {
    store.list_automations().await
}

#[tauri::command]
async fn automation_create(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    scheduler_trigger: tauri::State<'_, Arc<Notify>>,
    params: AutomationCreateParams,
) -> Result<AutomationRecord, String> {
    let automation = store.create_automation(params).await?;
    let _ = app.emit("automations-updated", serde_json::json!({}));
    scheduler_trigger.notify_one();
    Ok(automation)
}

#[tauri::command]
async fn automation_update(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    scheduler_trigger: tauri::State<'_, Arc<Notify>>,
    params: AutomationUpdateParams,
) -> Result<AutomationRecord, String> {
    let automation = store.update_automation(params).await?;
    let _ = app.emit("automations-updated", serde_json::json!({}));
    scheduler_trigger.notify_one();
    Ok(automation)
}

#[tauri::command]
async fn automation_delete(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    scheduler_trigger: tauri::State<'_, Arc<Notify>>,
    id: String,
) -> Result<(), String> {
    store.delete_automation(id).await?;
    let _ = app.emit("automations-updated", serde_json::json!({}));
    scheduler_trigger.notify_one();
    Ok(())
}

#[tauri::command]
async fn automation_run_now(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    bridge: tauri::State<'_, Arc<AppServerBridge>>,
    scheduler_trigger: tauri::State<'_, Arc<Notify>>,
    params: RunNowParams,
) -> Result<AutomationRunRecord, String> {
    let run = run_automation_by_id(
        app,
        Arc::clone(store.inner()),
        Arc::clone(bridge.inner()),
        params.automation_id,
    )
    .await?;
    scheduler_trigger.notify_one();
    Ok(run)
}

#[tauri::command]
async fn automation_runs_list(
    store: tauri::State<'_, Arc<AutomationStore>>,
    params: Option<AutomationRunsListParams>,
) -> Result<Vec<AutomationRunRecord>, String> {
    store
        .list_runs(params.and_then(|value| value.automation_id))
        .await
}

#[tauri::command]
async fn automation_run_archive(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    params: RunArchiveParams,
) -> Result<(), String> {
    store.archive_run(params).await?;
    let _ = app.emit("automation-runs-updated", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
async fn inbox_items(
    store: tauri::State<'_, Arc<AutomationStore>>,
) -> Result<Vec<automation_store::InboxItemRecord>, String> {
    store.list_inbox_items().await
}

#[tauri::command]
async fn inbox_mark_read(
    app: AppHandle,
    store: tauri::State<'_, Arc<AutomationStore>>,
    params: InboxMarkReadParams,
) -> Result<(), String> {
    store.mark_inbox_read(params.id).await?;
    let _ = app.emit("inbox-items-updated", serde_json::json!({}));
    Ok(())
}

#[tauri::command]
async fn terminal_list(
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
) -> Result<Vec<TerminalSessionDescriptor>, String> {
    Ok(terminal_host.list().await)
}

#[tauri::command]
async fn terminal_create(
    app: AppHandle,
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    params: TerminalCreateParams,
) -> Result<TerminalSessionDescriptor, String> {
    terminal_host.create(app, params).await
}

#[tauri::command]
async fn terminal_attach(
    app: AppHandle,
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    params: TerminalAttachParams,
) -> Result<TerminalSessionDescriptor, String> {
    terminal_host.attach(app, params.session_id).await
}

#[tauri::command]
async fn terminal_write(
    app: AppHandle,
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    params: TerminalWriteParams,
) -> Result<(), String> {
    terminal_host.write(app, params).await
}

#[tauri::command]
async fn terminal_resize(
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    params: TerminalResizeParams,
) -> Result<(), String> {
    terminal_host.resize(params).await
}

#[tauri::command]
async fn terminal_close(
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    params: TerminalCloseParams,
) -> Result<(), String> {
    terminal_host.close(params).await
}

#[tauri::command]
async fn cloud_run_start(
    app: AppHandle,
    cloud_host: tauri::State<'_, Arc<CloudRunHost>>,
    params: CloudRunStartParams,
) -> Result<CloudRunDescriptor, String> {
    cloud_host.start(app, params).await
}

#[tauri::command]
async fn cloud_run_cancel(
    app: AppHandle,
    cloud_host: tauri::State<'_, Arc<CloudRunHost>>,
    params: CloudRunCancelParams,
) -> Result<bool, String> {
    cloud_host.cancel(app, params).await
}

#[tauri::command]
async fn cloud_run_list(
    cloud_host: tauri::State<'_, Arc<CloudRunHost>>,
) -> Result<Vec<CloudRunDescriptor>, String> {
    Ok(cloud_host.list().await)
}

#[tauri::command]
fn bridge_get_build_flavor(
    state: tauri::State<'_, Arc<ElectronCompatRuntimeState>>,
) -> HostBuildFlavorPayload {
    HostBuildFlavorPayload {
        flavor: state.build_flavor.clone(),
        platform: std::env::consts::OS.to_string(),
        channel: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
    }
}

#[tauri::command]
fn host_get_renderer_mode(
    state: tauri::State<'_, Arc<ElectronCompatRuntimeState>>,
) -> HostRendererModePayload {
    HostRendererModePayload {
        mode: state.renderer_mode.clone(),
    }
}

#[tauri::command]
async fn bridge_message_from_view(
    app: AppHandle,
    params: BridgeMessageFromViewParams,
) -> Result<(), String> {
    let payload = serde_json::json!({
        "channel": params.channel,
        "payload": params.payload
    });
    let _ = app.emit("codex-desktop-message-from-view", payload.clone());
    let _ = app.emit("codex-desktop-message-for-view", payload);
    Ok(())
}

#[tauri::command]
fn bridge_show_context_menu(payload: Option<Value>) -> bool {
    let _ = payload;
    true
}

#[tauri::command]
fn bridge_get_sentry_init_options(
    state: tauri::State<'_, Arc<ElectronCompatRuntimeState>>,
) -> SentryInitOptions {
    state.sentry.clone()
}

#[tauri::command]
fn bridge_trigger_sentry_test() -> Result<(), String> {
    Err("intentional sentry test error trigger from tauri host".to_string())
}

async fn dispatch_electron_method(
    app: &AppHandle,
    bridge: &Arc<AppServerBridge>,
    state_store: &Arc<StateStore>,
    automation_store: &Arc<AutomationStore>,
    terminal_host: &Arc<TerminalHost>,
    method: &str,
    params: Value,
) -> Result<Value, CompatDispatchError> {
    if is_known_electron_query_method(method) {
        handle_electron_query(app, bridge, state_store, automation_store, method, params).await
    } else if is_known_electron_mutation_method(method) {
        handle_electron_mutation(
            app,
            bridge,
            state_store,
            automation_store,
            terminal_host,
            method,
            params,
        )
        .await
    } else {
        Err((
            "unknown_method".to_string(),
            format!("method '{method}' is not registered"),
            Some(serde_json::json!({
                "knownMethods": all_known_methods(),
                "dispatchRegistry": electron_dispatch_registry()
            })),
        ))
    }
}

fn method_from_vscode_fetch_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    let value = trimmed.strip_prefix("vscode://codex/")?;
    let method = value
        .split('?')
        .next()
        .unwrap_or_default()
        .trim_matches('/');
    if method.is_empty() {
        None
    } else {
        Some(method.to_string())
    }
}

fn parse_fetch_body_params(body: Option<&Value>) -> Value {
    match body {
        Some(Value::String(raw)) => {
            if raw.trim().is_empty() {
                serde_json::json!({})
            } else {
                serde_json::from_str(raw).unwrap_or_else(|_| serde_json::json!({}))
            }
        }
        Some(other) => other.clone(),
        None => serde_json::json!({}),
    }
}

fn fetch_response_success(request_id: &str, body: &Value) -> Value {
    serde_json::json!({
      "type": "fetch-response",
      "requestId": request_id,
      "responseType": "success",
      "status": 200,
      "headers": {},
      "bodyJsonString": serde_json::to_string(body).unwrap_or_else(|_| "null".to_string())
    })
}

fn fetch_response_error(request_id: &str, status: i64, error: impl Into<String>) -> Value {
    serde_json::json!({
      "type": "fetch-response",
      "requestId": request_id,
      "responseType": "error",
      "status": status,
      "error": error.into()
    })
}

fn worker_response_event(
    worker_id: &str,
    request_id: &str,
    method: &str,
    response: electron_compat::WorkerResponse,
) -> Value {
    let result = if response.ok {
        serde_json::json!({
          "type": "ok",
          "value": response.result.unwrap_or(Value::Null)
        })
    } else {
        let error = response.error.unwrap_or(electron_compat::HostError {
            code: "worker_error".to_string(),
            message: "worker request failed".to_string(),
            details: None,
        });
        serde_json::json!({
          "type": "error",
          "error": {
            "code": error.code,
            "message": error.message,
            "details": error.details
          }
        })
    };

    serde_json::json!({
      "type": "worker-response",
      "workerId": worker_id,
      "response": {
        "id": request_id,
        "method": method,
        "result": result
      }
    })
}

#[tauri::command]
async fn bridge_send_message_from_view(
    app: AppHandle,
    bridge: tauri::State<'_, Arc<AppServerBridge>>,
    state_store: tauri::State<'_, Arc<StateStore>>,
    automation_store: tauri::State<'_, Arc<AutomationStore>>,
    terminal_host: tauri::State<'_, Arc<TerminalHost>>,
    payload: Value,
) -> Result<(), String> {
    if let Some(message_type) = payload.get("type").and_then(Value::as_str) {
        match message_type {
            "fetch" => {
                let request_id = payload
                    .get("requestId")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "fetch message is missing requestId".to_string())?;
                let url = payload
                    .get("url")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "fetch message is missing url".to_string())?;
                let method = match method_from_vscode_fetch_url(url) {
                    Some(value) => value,
                    None => {
                        let response = fetch_response_error(
                            request_id,
                            400,
                            format!("unsupported fetch url: {url}"),
                        );
                        return emit_compat_message(&app, response);
                    }
                };
                let params = parse_fetch_body_params(payload.get("body"));
                let response = match dispatch_electron_method(
                    &app,
                    bridge.inner(),
                    state_store.inner(),
                    automation_store.inner(),
                    terminal_host.inner(),
                    &method,
                    params,
                )
                .await
                {
                    Ok(result) => fetch_response_success(request_id, &result),
                    Err((code, message, _details)) => {
                        fetch_response_error(request_id, 500, format!("{code}: {message}"))
                    }
                };
                return emit_compat_message(&app, response);
            }
            "fetch-stream" => {
                let request_id = payload
                    .get("requestId")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "fetch-stream message is missing requestId".to_string())?;
                let url = payload
                    .get("url")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "fetch-stream message is missing url".to_string())?;
                let method = match method_from_vscode_fetch_url(url) {
                    Some(value) => value,
                    None => {
                        let error_event = serde_json::json!({
                          "type": "fetch-stream-error",
                          "requestId": request_id,
                          "status": 400,
                          "error": format!("unsupported fetch stream url: {url}")
                        });
                        return emit_compat_message(&app, error_event);
                    }
                };
                let params = parse_fetch_body_params(payload.get("body"));
                match dispatch_electron_method(
                    &app,
                    bridge.inner(),
                    state_store.inner(),
                    automation_store.inner(),
                    terminal_host.inner(),
                    &method,
                    params,
                )
                .await
                {
                    Ok(result) => {
                        let event = serde_json::json!({
                          "type": "fetch-stream-event",
                          "requestId": request_id,
                          "data": result
                        });
                        emit_compat_message(&app, event)?;
                        let completed = serde_json::json!({
                          "type": "fetch-stream-complete",
                          "requestId": request_id
                        });
                        return emit_compat_message(&app, completed);
                    }
                    Err((code, message, _details)) => {
                        let error_event = serde_json::json!({
                          "type": "fetch-stream-error",
                          "requestId": request_id,
                          "status": 500,
                          "error": format!("{code}: {message}")
                        });
                        return emit_compat_message(&app, error_event);
                    }
                }
            }
            "cancel-fetch" | "cancel-fetch-stream" => {
                return Ok(());
            }
            _ => {
                let _ = app.emit("codex-desktop-message-from-view", payload.clone());
                let _ = app.emit("codex-desktop-message-for-view", payload);
                return Ok(());
            }
        }
    }

    let envelope = parse_bridge_request_payload(payload)?;
    let method = envelope.method.clone();
    let response = match dispatch_electron_method(
        &app,
        bridge.inner(),
        state_store.inner(),
        automation_store.inner(),
        terminal_host.inner(),
        &method,
        envelope.params,
    )
    .await
    {
        Ok(result) => jsonrpc_success(envelope.id, result),
        Err((code, message, details)) => jsonrpc_error(envelope.id, code, message, details),
    };

    emit_compat_message(&app, response)
}

#[tauri::command]
async fn bridge_send_worker_message_from_view(
    app: AppHandle,
    worker_id: String,
    payload: Value,
) -> Result<(), String> {
    if let Some(message_type) = payload.get("type").and_then(Value::as_str) {
        match message_type {
            "worker-request-cancel" => return Ok(()),
            "worker-request" => {
                let request = payload
                    .get("request")
                    .and_then(Value::as_object)
                    .ok_or_else(|| {
                        "worker-request payload is missing request object".to_string()
                    })?;
                let request_id = request
                    .get("id")
                    .map(electron_compat::id_to_key)
                    .ok_or_else(|| "worker-request is missing id".to_string())?;
                let method = request
                    .get("method")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "worker-request is missing method".to_string())?
                    .to_string();
                let params = request
                    .get("params")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));
                let request = WorkerRequest {
                    worker_id: worker_id.clone(),
                    method: method.clone(),
                    params,
                    request_id: request_id.clone(),
                };
                let response = if worker_id == "git" {
                    handle_git_worker(request).await
                } else {
                    electron_compat::WorkerResponse {
                        worker_id: worker_id.clone(),
                        request_id: request_id.clone(),
                        ok: false,
                        result: None,
                        error: Some(electron_compat::HostError {
                            code: "worker_not_supported".to_string(),
                            message: "only the git worker is currently wired in Tauri".to_string(),
                            details: None,
                        }),
                    }
                };
                let channel = format!("codex_desktop:worker:{worker_id}:for-view");
                let event = worker_response_event(&worker_id, &request_id, &method, response);
                app.emit(&channel, event)
                    .map_err(|error| error.to_string())?;
                return Ok(());
            }
            _ => {}
        }
    }

    let envelope = parse_bridge_request_payload(payload)?;
    let request = WorkerRequest {
        worker_id: worker_id.clone(),
        method: envelope.method.clone(),
        params: envelope.params,
        request_id: electron_compat::id_to_key(&envelope.id),
    };
    let response = if worker_id == "git" {
        handle_git_worker(request).await
    } else {
        electron_compat::WorkerResponse {
            worker_id: worker_id.clone(),
            request_id: electron_compat::id_to_key(&envelope.id),
            ok: false,
            result: None,
            error: Some(electron_compat::HostError {
                code: "worker_not_supported".to_string(),
                message: "only the git worker is currently wired in Tauri".to_string(),
                details: None,
            }),
        }
    };
    let channel = format!("codex_desktop:worker:{worker_id}:for-view");
    let event = worker_response_event(
        &worker_id,
        &electron_compat::id_to_key(&envelope.id),
        &envelope.method,
        response,
    );
    app.emit(&channel, event).map_err(|error| error.to_string())
}

#[tauri::command]
fn host_get_update_state(
    state: tauri::State<'_, Arc<RuntimeHostState>>,
) -> Result<HostUpdateStatePayload, String> {
    state
        .update_state
        .lock()
        .map(|value| value.clone())
        .map_err(|error| format!("failed to read update state: {error}"))
}

#[tauri::command]
async fn host_check_updates(
    app: AppHandle,
    state: tauri::State<'_, Arc<RuntimeHostState>>,
) -> Result<HostUpdateStatePayload, String> {
    let now = now_ts();
    let checking = {
        let current = state
            .update_state
            .lock()
            .map_err(|error| format!("failed to lock update state: {error}"))?
            .clone();
        apply_update_transition(current, HostUpdateTransition::StartCheck, now)
    };
    {
        let mut guard = state
            .update_state
            .lock()
            .map_err(|error| format!("failed to lock update state: {error}"))?;
        *guard = checking.clone();
    }
    let _ = app.emit("host-update-state", checking.clone());
    tokio::time::sleep(Duration::from_millis(120)).await;
    let completed = {
        let current = state
            .update_state
            .lock()
            .map_err(|error| format!("failed to lock update state: {error}"))?
            .clone();
        let transition = if std::env::var("CODEX_DESKTOP_FAKE_UPDATE_AVAILABLE")
            .ok()
            .as_deref()
            == Some("1")
        {
            HostUpdateTransition::MarkAvailable
        } else {
            HostUpdateTransition::MarkUpToDate
        };
        apply_update_transition(current, transition, now_ts())
    };
    {
        let mut guard = state
            .update_state
            .lock()
            .map_err(|error| format!("failed to lock update state: {error}"))?;
        *guard = completed.clone();
    }
    let _ = app.emit("host-update-state", completed.clone());
    Ok(completed)
}

#[tauri::command]
fn host_dispatch_deeplink(
    app: AppHandle,
    url: String,
) -> Result<runtime_contract::HostDeeplinkPayload, String> {
    let payload = parse_codex_deeplink(&url)?;
    let _ = app.emit("host-deeplink", payload.clone());
    Ok(payload)
}

#[tauri::command]
fn host_open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("url is required".to_string());
    }
    webbrowser::open(trimmed).map_err(|error| format!("failed to open external URL: {error}"))?;
    Ok(())
}

type CompatDispatchError = (String, String, Option<Value>);

fn emit_compat_message(app: &AppHandle, payload: Value) -> Result<(), String> {
    app.emit(COMPAT_APP_CHANNEL_FOR_VIEW, payload.clone())
        .map_err(|error| error.to_string())?;
    let _ = app.emit("codex-desktop-message-for-view", payload);
    Ok(())
}

fn normalize_state_key(space: &str) -> &'static str {
    match space {
        "configuration" => "configuration",
        "global-state" => "global-state",
        _ => "global-state",
    }
}

async fn read_named_state_map(
    state_store: &Arc<StateStore>,
    space: &str,
) -> Result<serde_json::Map<String, Value>, CompatDispatchError> {
    let value = state_store
        .get_json_state(normalize_state_key(space))
        .await
        .map_err(|error| ("state_read_error".to_string(), error, None))?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

async fn write_named_state_map(
    state_store: &Arc<StateStore>,
    space: &str,
    map: serde_json::Map<String, Value>,
) -> Result<(), CompatDispatchError> {
    state_store
        .set_json_state(normalize_state_key(space), &Value::Object(map))
        .await
        .map_err(|error| ("state_write_error".to_string(), error, None))
}

fn string_array_from_value(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn local_environment_snapshot() -> Value {
    let keys = ["SHELL", "ComSpec", "HOME", "USERPROFILE", "PATH", "TERM"];
    let mut env_map = serde_json::Map::new();
    for key in keys {
        if let Some(value) = std::env::var_os(key) {
            env_map.insert(
                key.to_string(),
                Value::String(value.to_string_lossy().to_string()),
            );
        }
    }
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string();
    serde_json::json!({
      "cwd": cwd,
      "env": Value::Object(env_map),
      "shell": std::env::var("SHELL").ok().or_else(|| std::env::var("ComSpec").ok())
    })
}

async fn run_git_capture(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    configure_command_for_desktop(&mut command);
    command.current_dir(cwd);
    command.args(args);
    let output = command
        .output()
        .await
        .map_err(|error| format!("failed to run git command '{:?}': {error}", args))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string()
            .if_empty_then(format!(
                "git command failed with status {}",
                output.status.code().unwrap_or(-1)
            )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn forward_translated_app_server_method(
    app: &AppHandle,
    bridge: &Arc<AppServerBridge>,
    original_request_id: Value,
    method: &str,
    params: &Value,
) -> Result<Value, CompatDispatchError> {
    let Some((translated_method, translated_params)) = translated_app_server_method(method, params)
    else {
        return Err((
            "unsupported_method".to_string(),
            format!("method '{method}' is not supported by this host"),
            None,
        ));
    };

    let request = serde_json::json!({
      "id": original_request_id,
      "method": translated_method,
      "params": translated_params
    });
    let response = bridge
        .request(app.clone(), request)
        .await
        .map_err(|error| ("app_server_error".to_string(), error, None))?;
    if let Some(error) = response.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("app-server request failed")
            .to_string();
        return Err(("app_server_error".to_string(), message, Some(error.clone())));
    }
    Ok(response
        .get("result")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({})))
}

async fn handle_electron_query(
    app: &AppHandle,
    bridge: &Arc<AppServerBridge>,
    state_store: &Arc<StateStore>,
    automation_store: &Arc<AutomationStore>,
    method: &str,
    params: Value,
) -> Result<Value, CompatDispatchError> {
    match method {
        "dispatch-registry" => Ok(electron_dispatch_registry()),
        "get-configuration" => {
            let map = read_named_state_map(state_store, "configuration").await?;
            if let Some(key) = params.get("key").and_then(Value::as_str) {
                Ok(serde_json::json!({
                  "value": map.get(key).cloned().unwrap_or(Value::Null)
                }))
            } else {
                Ok(Value::Object(map))
            }
        }
        "get-global-state" => {
            let map = read_named_state_map(state_store, "global-state").await?;
            if let Some(key) = params.get("key").and_then(Value::as_str) {
                Ok(serde_json::json!({
                  "value": map.get(key).cloned().unwrap_or(Value::Null)
                }))
            } else {
                Ok(Value::Object(map))
            }
        }
        "active-workspace-roots" => {
            let map = read_named_state_map(state_store, "global-state").await?;
            let roots = string_array_from_value(map.get("activeWorkspaceRoots"));
            Ok(serde_json::json!({ "roots": roots }))
        }
        "workspace-root-options" => {
            let map = read_named_state_map(state_store, "global-state").await?;
            let roots = string_array_from_value(map.get("workspaceRootOptions"));
            let labels = map
                .get("workspaceRootLabels")
                .cloned()
                .unwrap_or_else(|| serde_json::json!({}));
            Ok(serde_json::json!({
              "roots": roots,
              "labels": labels
            }))
        }
        "list-pinned-threads" => {
            let map = read_named_state_map(state_store, "global-state").await?;
            let thread_ids = string_array_from_value(map.get("pinnedThreadIds"));
            Ok(serde_json::json!({ "threadIds": thread_ids }))
        }
        "list-automations" => {
            let items = automation_store
                .list_automations()
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "items": items }))
        }
        "pending-automation-runs" => {
            let runs = automation_store
                .list_runs(None)
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "runs": runs }))
        }
        "list-pending-automation-run-threads" => {
            let runs = automation_store
                .list_runs(None)
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            let mut thread_ids = Vec::<String>::new();
            for run in runs {
                if run.status.eq_ignore_ascii_case("ARCHIVED") {
                    continue;
                }
                if !thread_ids.contains(&run.thread_id) {
                    thread_ids.push(run.thread_id);
                }
            }
            Ok(serde_json::json!({ "threadIds": thread_ids }))
        }
        "inbox-items" => {
            let items = automation_store
                .list_inbox_items()
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "items": items }))
        }
        "paths-exist" => {
            let paths = string_array_from_value(params.get("paths"));
            let existing_paths: Vec<String> = paths
                .into_iter()
                .filter(|path| Path::new(path).exists())
                .collect();
            Ok(serde_json::json!({ "existingPaths": existing_paths }))
        }
        "read-file" => {
            let path = params.get("path").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "path is required".to_string(),
                    None,
                )
            })?;
            let contents = std::fs::read_to_string(path).map_err(|error| {
                (
                    "io_error".to_string(),
                    format!("failed to read file: {error}"),
                    None,
                )
            })?;
            Ok(serde_json::json!({ "contents": contents }))
        }
        "read-file-binary" => {
            let path = params.get("path").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "path is required".to_string(),
                    None,
                )
            })?;
            let bytes = std::fs::read(path).map_err(|error| {
                (
                    "io_error".to_string(),
                    format!("failed to read file: {error}"),
                    None,
                )
            })?;
            Ok(serde_json::json!({
              "contentsBase64": base64::engine::general_purpose::STANDARD.encode(bytes)
            }))
        }
        "read-git-file-binary" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let path = params.get("path").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "path is required".to_string(),
                    None,
                )
            })?;
            let reference = params.get("ref").and_then(Value::as_str).unwrap_or("HEAD");
            let git_object = if reference.eq_ignore_ascii_case("head") {
                format!("HEAD:{path}")
            } else {
                format!("{reference}:{path}")
            };
            let contents = run_git_capture(cwd, &["show", &git_object])
                .await
                .map_err(|error| ("git_error".to_string(), error, None))?;
            Ok(serde_json::json!({
              "contentsBase64": base64::engine::general_purpose::STANDARD.encode(contents.as_bytes())
            }))
        }
        "find-files" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let query = params
                .get("query")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_ascii_lowercase();
            let mut files = Vec::<String>::new();
            for entry in WalkDir::new(cwd)
                .max_depth(8)
                .into_iter()
                .filter_map(Result::ok)
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let path = entry.path().to_string_lossy().to_string();
                if query.is_empty() || path.to_ascii_lowercase().contains(&query) {
                    files.push(path);
                }
                if files.len() >= 500 {
                    break;
                }
            }
            Ok(serde_json::json!({ "files": files }))
        }
        "codex-home" => {
            let codex_home =
                codex_home_dir().map_err(|error| ("path_error".to_string(), error, None))?;
            Ok(serde_json::json!({
              "codexHome": codex_home,
              "worktreesSegment": codex_home.join("worktrees")
            }))
        }
        "extension-info" => Ok(serde_json::json!({
          "version": env!("CARGO_PKG_VERSION"),
          "buildNumber": Value::Null,
          "buildFlavor": if cfg!(debug_assertions) { "debug" } else { "release" }
        })),
        "locale-info" => Ok(serde_json::json!({
          "ideLocale": std::env::var("LANG").ok(),
          "systemLocale": std::env::var("LANG").ok()
        })),
        "local-environment" => Ok(serde_json::json!({
          "environment": local_environment_snapshot()
        })),
        "local-environments" => Ok(serde_json::json!({
          "environments": [local_environment_snapshot()]
        })),
        "os-info" => Ok(serde_json::json!({
          "platform": std::env::consts::OS,
          "hasWsl": std::env::var_os("WSL_DISTRO_NAME").is_some(),
          "isVsCodeRunningInsideWsl": false
        })),
        "open-in-targets" => Ok(serde_json::json!({
          "preferredTarget": Value::Null,
          "availableTargets": ["terminal"],
          "targets": [{
            "id": "terminal",
            "label": "Terminal",
            "available": true,
            "default": true
          }]
        })),
        "third-party-notices" => {
            let notice = std::fs::read_to_string("NOTICE").unwrap_or_default();
            Ok(serde_json::json!({ "text": notice }))
        }
        "gh-cli-status" => {
            let installed = which::which("gh").is_ok();
            Ok(serde_json::json!({
              "installed": installed,
              "authenticated": false
            }))
        }
        "gh-pr-status" => Ok(serde_json::json!({
          "available": false
        })),
        "git-origins" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let output = run_git_capture(cwd, &["remote", "-v"])
                .await
                .unwrap_or_default();
            let mut origins = HashSet::<String>::new();
            for line in output.lines() {
                let mut parts = line.split_whitespace();
                let _name = parts.next();
                if let Some(url) = parts.next() {
                    origins.insert(url.to_string());
                }
            }
            Ok(serde_json::json!({ "origins": origins.into_iter().collect::<Vec<_>>() }))
        }
        "has-custom-cli-executable" => Ok(serde_json::json!({
          "hasCustomCliExecutable": std::env::var_os("CODEX_CLI_PATH").is_some()
        })),
        "ide-context" => Ok(serde_json::json!({ "ideContext": Value::Null })),
        "is-copilot-api-available" => Ok(serde_json::json!({ "available": false })),
        "child-processes" => Ok(serde_json::json!({ "processes": [] })),
        "recommended-skills" | "account-info" => {
            let translated = forward_translated_app_server_method(
                app,
                bridge,
                Value::String(format!("compat-{}", next_request_id())),
                method,
                &params,
            )
            .await
            .unwrap_or_else(|_| serde_json::json!({}));
            if method == "account-info" {
                let account = translated
                    .get("account")
                    .cloned()
                    .unwrap_or_else(|| translated.clone());
                Ok(serde_json::json!({
                  "accountId": account.get("accountId").or_else(|| account.get("id")).cloned().unwrap_or(Value::Null),
                  "userId": account.get("userId").or_else(|| account.get("user_id")).cloned().unwrap_or(Value::Null),
                  "plan": account.get("plan").or_else(|| account.get("planType")).cloned().unwrap_or(Value::Null),
                  "email": account.get("email").cloned().unwrap_or(Value::Null)
                }))
            } else {
                Ok(translated)
            }
        }
        _ => {
            forward_translated_app_server_method(
                app,
                bridge,
                Value::String(format!("compat-{}", next_request_id())),
                method,
                &params,
            )
            .await
        }
    }
}

async fn handle_electron_mutation(
    app: &AppHandle,
    bridge: &Arc<AppServerBridge>,
    state_store: &Arc<StateStore>,
    automation_store: &Arc<AutomationStore>,
    terminal_host: &Arc<TerminalHost>,
    method: &str,
    params: Value,
) -> Result<Value, CompatDispatchError> {
    match method {
        "set-configuration" | "set-global-state" => {
            let space = if method == "set-configuration" {
                "configuration"
            } else {
                "global-state"
            };
            let mut map = read_named_state_map(state_store, space).await?;
            if let (Some(key), Some(value)) = (
                params.get("key").and_then(Value::as_str),
                params.get("value"),
            ) {
                map.insert(key.to_string(), value.clone());
                write_named_state_map(state_store, space, map).await?;
                Ok(serde_json::json!({ "success": true }))
            } else if let Some(value) = params.get("value").and_then(Value::as_object) {
                write_named_state_map(state_store, space, value.clone()).await?;
                Ok(serde_json::json!({ "success": true }))
            } else {
                Err((
                    "invalid_params".to_string(),
                    "set state requires {key, value} or {value:{...}}".to_string(),
                    None,
                ))
            }
        }
        "add-workspace-root-option" => {
            let root = params.get("root").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "root is required".to_string(),
                    None,
                )
            })?;
            let label = params.get("label").and_then(Value::as_str);
            let set_active = params
                .get("setActive")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let mut map = read_named_state_map(state_store, "global-state").await?;
            let mut roots = string_array_from_value(map.get("workspaceRootOptions"));
            if !roots.contains(&root.to_string()) {
                roots.insert(0, root.to_string());
            }
            map.insert(
                "workspaceRootOptions".to_string(),
                Value::Array(roots.into_iter().map(Value::String).collect()),
            );
            if let Some(label) = label {
                let mut labels = map
                    .get("workspaceRootLabels")
                    .and_then(Value::as_object)
                    .cloned()
                    .unwrap_or_default();
                labels.insert(root.to_string(), Value::String(label.to_string()));
                map.insert("workspaceRootLabels".to_string(), Value::Object(labels));
            }
            if set_active {
                map.insert(
                    "activeWorkspaceRoots".to_string(),
                    Value::Array(vec![Value::String(root.to_string())]),
                );
            }
            write_named_state_map(state_store, "global-state", map).await?;
            Ok(serde_json::json!({ "success": true }))
        }
        "set-preferred-app" => {
            let mut map = read_named_state_map(state_store, "global-state").await?;
            map.insert(
                "preferredOpenTarget".to_string(),
                params
                    .get("target")
                    .cloned()
                    .unwrap_or(Value::String("terminal".to_string())),
            );
            write_named_state_map(state_store, "global-state", map).await?;
            Ok(serde_json::json!({ "success": true }))
        }
        "automation-create" => {
            let name = params.get("name").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "name is required".to_string(),
                    None,
                )
            })?;
            let prompt = params
                .get("prompt")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "prompt is required".to_string(),
                        None,
                    )
                })?;
            let cwds = string_array_from_value(params.get("cwds"));
            let rrule = params.get("rrule").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "rrule is required".to_string(),
                    None,
                )
            })?;
            let created = automation_store
                .create_automation(AutomationCreateParams {
                    name: name.to_string(),
                    prompt: prompt.to_string(),
                    status: params
                        .get("status")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    next_run_at: params.get("nextRunAt").and_then(Value::as_i64),
                    last_run_at: params.get("lastRunAt").and_then(Value::as_i64),
                    cwds,
                    rrule: rrule.to_string(),
                })
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "item": created }))
        }
        "automation-update" => {
            let id = params.get("id").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "id is required".to_string(),
                    None,
                )
            })?;
            let updated = automation_store
                .update_automation(AutomationUpdateParams {
                    id: id.to_string(),
                    name: params
                        .get("name")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    prompt: params
                        .get("prompt")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    status: params
                        .get("status")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    next_run_at: params.get("nextRunAt").and_then(Value::as_i64),
                    last_run_at: params.get("lastRunAt").and_then(Value::as_i64),
                    cwds: params
                        .get("cwds")
                        .map(|_| string_array_from_value(params.get("cwds"))),
                    rrule: params
                        .get("rrule")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                })
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "item": updated }))
        }
        "automation-delete" => {
            let id = params.get("id").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "id is required".to_string(),
                    None,
                )
            })?;
            automation_store
                .delete_automation(id.to_string())
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": true }))
        }
        "automation-run-now" => {
            let automation_id = params
                .get("id")
                .or_else(|| params.get("automationId"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "id or automationId is required".to_string(),
                        None,
                    )
                })?;
            run_automation_by_id(
                app.clone(),
                Arc::clone(automation_store),
                Arc::clone(bridge),
                automation_id.to_string(),
            )
            .await
            .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": true }))
        }
        "automation-run-delete" => {
            let thread_id = params
                .get("threadId")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "threadId is required".to_string(),
                        None,
                    )
                })?;
            let deleted = automation_store
                .delete_run_by_thread_id(thread_id.to_string())
                .await
                .map_err(|error| ("automation_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": deleted }))
        }
        "local-environment-config-save" => {
            let config_path = params
                .get("configPath")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "configPath is required".to_string(),
                        None,
                    )
                })?;
            let raw = params.get("raw").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "raw is required".to_string(),
                    None,
                )
            })?;
            if let Some(parent) = Path::new(config_path).parent() {
                std::fs::create_dir_all(parent).map_err(|error| {
                    (
                        "io_error".to_string(),
                        format!("failed to create config directory: {error}"),
                        None,
                    )
                })?;
            }
            std::fs::write(config_path, raw).map_err(|error| {
                (
                    "io_error".to_string(),
                    format!("failed to write config file: {error}"),
                    None,
                )
            })?;
            Ok(serde_json::json!({
              "configPath": config_path,
              "success": true
            }))
        }
        "apply-patch" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let patch = params
                .get("patch")
                .or_else(|| params.get("patchText"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "patch text is required".to_string(),
                        None,
                    )
                })?;
            let cached = params
                .get("cached")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let reverse = params
                .get("reverse")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let result = git_apply_patch(cwd.to_string(), patch.to_string(), cached, reverse)
                .await
                .map_err(|error| ("git_error".to_string(), error, None))?;
            Ok(serde_json::json!({
              "code": result.code,
              "stdout": result.stdout,
              "stderr": result.stderr
            }))
        }
        "git-checkout-branch" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let branch = params
                .get("branch")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "branch is required".to_string(),
                        None,
                    )
                })?;
            run_git_capture(cwd, &["checkout", branch])
                .await
                .map_err(|error| ("git_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": true }))
        }
        "git-create-branch" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let branch = params
                .get("branch")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "branch is required".to_string(),
                        None,
                    )
                })?;
            let base = params.get("base").and_then(Value::as_str).unwrap_or("HEAD");
            run_git_capture(cwd, &["checkout", "-b", branch, base])
                .await
                .map_err(|error| ("git_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": true }))
        }
        "git-push" => {
            let cwd = params.get("cwd").and_then(Value::as_str).unwrap_or(".");
            let remote = params
                .get("remote")
                .and_then(Value::as_str)
                .unwrap_or("origin");
            let branch = params
                .get("branch")
                .and_then(Value::as_str)
                .unwrap_or("HEAD");
            run_git_capture(cwd, &["push", remote, branch])
                .await
                .map_err(|error| ("git_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "success": true }))
        }
        "terminal-create" => {
            let descriptor = terminal_host
                .create(
                    app.clone(),
                    TerminalCreateParams {
                        thread_id: params
                            .get("threadId")
                            .and_then(Value::as_str)
                            .map(ToString::to_string),
                        workspace_path: params
                            .get("workspacePath")
                            .or_else(|| params.get("cwd"))
                            .and_then(Value::as_str)
                            .map(ToString::to_string),
                        cwd: params
                            .get("cwd")
                            .and_then(Value::as_str)
                            .map(ToString::to_string),
                    },
                )
                .await
                .map_err(|error| ("terminal_error".to_string(), error, None))?;
            Ok(serde_json::json!({
              "session": {
                "id": descriptor.session_id,
                "cwd": descriptor.cwd,
                "cols": 80,
                "rows": 24
              }
            }))
        }
        "terminal-attach" => {
            let session_id = params
                .get("id")
                .or_else(|| params.get("sessionId"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "id/sessionId is required".to_string(),
                        None,
                    )
                })?;
            let descriptor = terminal_host
                .attach(app.clone(), session_id.to_string())
                .await
                .map_err(|error| ("terminal_error".to_string(), error, None))?;
            Ok(serde_json::json!({
              "session": {
                "id": descriptor.session_id,
                "cwd": descriptor.cwd,
                "cols": 80,
                "rows": 24
              }
            }))
        }
        "terminal-write" => {
            let session_id = params
                .get("id")
                .or_else(|| params.get("sessionId"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "id/sessionId is required".to_string(),
                        None,
                    )
                })?;
            let text = params
                .get("text")
                .or_else(|| params.get("input"))
                .and_then(Value::as_str)
                .unwrap_or("");
            terminal_host
                .write(
                    app.clone(),
                    TerminalWriteParams {
                        session_id: session_id.to_string(),
                        input: text.to_string(),
                        raw: Some(true),
                    },
                )
                .await
                .map_err(|error| ("terminal_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "ok": true }))
        }
        "terminal-resize" => {
            let session_id = params
                .get("id")
                .or_else(|| params.get("sessionId"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "id/sessionId is required".to_string(),
                        None,
                    )
                })?;
            let cols = params.get("cols").and_then(Value::as_u64).unwrap_or(120) as u16;
            let rows = params.get("rows").and_then(Value::as_u64).unwrap_or(30) as u16;
            terminal_host
                .resize(TerminalResizeParams {
                    session_id: session_id.to_string(),
                    cols,
                    rows,
                })
                .await
                .map_err(|error| ("terminal_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "ok": true }))
        }
        "terminal-close" => {
            let session_id = params
                .get("id")
                .or_else(|| params.get("sessionId"))
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    (
                        "invalid_params".to_string(),
                        "id/sessionId is required".to_string(),
                        None,
                    )
                })?;
            terminal_host
                .close(TerminalCloseParams {
                    session_id: session_id.to_string(),
                })
                .await
                .map_err(|error| ("terminal_error".to_string(), error, None))?;
            Ok(serde_json::json!({ "ok": true }))
        }
        "open-file" => {
            let path = params.get("path").and_then(Value::as_str).ok_or_else(|| {
                (
                    "invalid_params".to_string(),
                    "path is required".to_string(),
                    None,
                )
            })?;
            let file_url = format!("file://{}", path.replace('\\', "/"));
            webbrowser::open(&file_url).map_err(|error| {
                (
                    "open_error".to_string(),
                    format!("failed to open file: {error}"),
                    None,
                )
            })?;
            Ok(serde_json::json!({ "success": true }))
        }
        "generate-thread-title" => Ok(serde_json::json!({ "title": Value::Null })),
        "generate-pull-request-message" => Ok(serde_json::json!({
          "title": Value::Null,
          "body": Value::Null
        })),
        "gh-pr-create" | "install-recommended-skill" | "remove-skill" => Ok(serde_json::json!({
          "success": false,
          "error": format!("method '{method}' is not implemented in this build")
        })),
        _ => Err((
            "unsupported_method".to_string(),
            format!("method '{method}' is not yet supported in this host"),
            None,
        )),
    }
}

trait EmptyToOption {
    fn if_empty_then(self, fallback: String) -> String;
}

impl EmptyToOption for String {
    fn if_empty_then(self, fallback: String) -> String {
        if self.trim().is_empty() {
            fallback
        } else {
            self
        }
    }
}

fn next_request_id() -> u64 {
    REQUEST_NONCE.fetch_add(1, Ordering::Relaxed)
}

async fn run_automation_by_id(
    app: AppHandle,
    store: Arc<AutomationStore>,
    bridge: Arc<AppServerBridge>,
    automation_id: String,
) -> Result<AutomationRunRecord, String> {
    let automation = store
        .automation_by_id(automation_id)
        .await?
        .ok_or_else(|| "automation not found".to_string())?;
    run_automation_record(app, store, bridge, automation).await
}

async fn run_automation_record(
    app: AppHandle,
    store: Arc<AutomationStore>,
    bridge: Arc<AppServerBridge>,
    automation: AutomationRecord,
) -> Result<AutomationRunRecord, String> {
    bridge
        .ensure_ready(
            app.clone(),
            None,
            automation.cwds.first().cloned(),
            Some(AppServerClientInfo {
                name: "codex_desktop_automation".to_string(),
                title: "Codex Desktop Automation".to_string(),
                version: "0.1.0".to_string(),
            }),
        )
        .await?;

    let cwd = automation.cwds.first().cloned();
    let thread_start_request = serde_json::json!({
        "id": next_request_id(),
        "method": "thread/start",
        "params": {
            "cwd": cwd,
            "model": serde_json::Value::Null,
            "experimentalRawEvents": false
        }
    });
    let thread_start_response = bridge.request(app.clone(), thread_start_request).await?;
    let thread_id = read_thread_id(&thread_start_response)
        .ok_or_else(|| "thread/start did not return thread id".to_string())?;
    let run = store
        .create_run(&automation, thread_id.clone(), "IN_PROGRESS".to_string())
        .await?;
    store
        .set_automation_next_run_at(automation.id.clone(), None)
        .await?;
    let _ = app.emit("automation-runs-updated", serde_json::json!({}));

    let turn_start_request = serde_json::json!({
        "id": next_request_id(),
        "method": "turn/start",
        "params": {
            "threadId": thread_id,
            "input": [{"type": "text", "text": automation.prompt}],
            "cwd": automation.cwds.first().cloned(),
            "effort": serde_json::Value::Null
        }
    });
    if let Err(error) = bridge.request(app.clone(), turn_start_request).await {
        store
            .update_run_status(
                run.id.clone(),
                "FAILED".to_string(),
                None,
                Some(format!("Automation: {}", automation.name)),
                Some("Automation run failed before completion.".to_string()),
            )
            .await?;
        let failed_run = store
            .run_by_id(run.id.clone())
            .await?
            .unwrap_or(run.clone());
        store.create_inbox_item_for_run(&failed_run).await?;
        store
            .touch_automation_run_times(automation.id.clone(), now_ts(), automation.rrule.clone())
            .await?;
        let _ = app.emit("automation-runs-updated", serde_json::json!({}));
        let _ = app.emit("inbox-items-updated", serde_json::json!({}));
        return Err(error);
    }

    let _ = app.emit("automation-runs-updated", serde_json::json!({}));
    Ok(run)
}

fn read_thread_id(response: &serde_json::Value) -> Option<String> {
    response
        .get("result")
        .and_then(|value| value.get("thread"))
        .and_then(|value| value.get("id"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .or_else(|| {
            response
                .get("thread")
                .and_then(|value| value.get("id"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
}

fn completed_run_status(notification: &Value) -> Option<(String, String)> {
    let method = notification.get("method")?.as_str()?;
    if method != "turn/completed" {
        return None;
    }
    let params = notification.get("params")?;
    let thread_id = params
        .get("threadId")
        .or_else(|| params.get("thread_id"))?
        .as_str()?
        .to_string();
    let turn_status = params
        .get("turn")
        .and_then(|turn| turn.get("status"))
        .and_then(Value::as_str)
        .map(|value| value.to_ascii_lowercase())?;
    let run_status = match turn_status.as_str() {
        "completed" => "PENDING_REVIEW",
        "failed" => "FAILED",
        "interrupted" => "INTERRUPTED",
        _ => return None,
    };
    Some((thread_id, run_status.to_string()))
}

fn inbox_summary_for_run_status(status: &str) -> String {
    match status {
        "PENDING_REVIEW" => "Automation run completed and ready for review.".to_string(),
        "FAILED" => "Automation run failed. Open the thread for details.".to_string(),
        "INTERRUPTED" => "Automation run was interrupted before completion.".to_string(),
        _ => "New automation output is ready for review.".to_string(),
    }
}

async fn reconcile_automation_run_completion(
    app: AppHandle,
    store: Arc<AutomationStore>,
    notification: Value,
) -> Result<(), String> {
    let Some((thread_id, next_status)) = completed_run_status(&notification) else {
        return Ok(());
    };
    let Some(run) = store.run_by_thread_id(thread_id).await? else {
        return Ok(());
    };
    if !run.status.eq_ignore_ascii_case("IN_PROGRESS") {
        return Ok(());
    }
    let automation = store.automation_by_id(run.automation_id.clone()).await?;
    let inbox_title = automation
        .as_ref()
        .map(|record| format!("Automation: {}", record.name))
        .unwrap_or_else(|| "Automation run".to_string());
    let inbox_summary = inbox_summary_for_run_status(&next_status);
    store
        .update_run_status(
            run.id.clone(),
            next_status,
            None,
            Some(inbox_title),
            Some(inbox_summary),
        )
        .await?;
    let updated_run = store.run_by_id(run.id.clone()).await?.unwrap_or(run);
    store.create_inbox_item_for_run(&updated_run).await?;
    if let Some(automation) = automation {
        store
            .touch_automation_run_times(automation.id.clone(), now_ts(), automation.rrule.clone())
            .await?;
    }
    let _ = app.emit("automation-runs-updated", serde_json::json!({}));
    let _ = app.emit("inbox-items-updated", serde_json::json!({}));
    Ok(())
}

fn main() {
    let renderer_mode = resolve_renderer_mode();
    let build_flavor = std::env::var("CODEX_DESKTOP_BUILD_FLAVOR")
        .or_else(|_| std::env::var("CODEX_BUILD_FLAVOR"))
        .unwrap_or_else(|_| {
            if cfg!(debug_assertions) {
                "dev".to_string()
            } else {
                "prod".to_string()
            }
        });
    let compat_runtime_state = ElectronCompatRuntimeState {
        sentry: SentryInitOptions {
            codex_app_session_id: Uuid::new_v4().to_string(),
            build_flavor: build_flavor.clone(),
            build_number: std::env::var("CODEX_BUILD_NUMBER")
                .ok()
                .or_else(|| std::env::var("BUILD_NUMBER").ok()),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
        },
        build_flavor,
        renderer_mode,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(AppServerBridge::new()))
        .manage(Arc::new(
            StateStore::new().expect("failed to initialize persisted state store"),
        ))
        .manage(Arc::new(
            AutomationStore::new().expect("failed to initialize automation store"),
        ))
        .manage(Arc::new(Notify::new()))
        .manage(Arc::new(TerminalHost::new()))
        .manage(Arc::new(CloudRunHost::new()))
        .manage(Arc::new(RuntimeHostState::new()))
        .manage(Arc::new(compat_runtime_state))
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.create_overlay_titlebar();
                }
            }

            let app_handle = app.handle().clone();
            let automation_store = Arc::clone(app.state::<Arc<AutomationStore>>().inner());
            let app_server_bridge = Arc::clone(app.state::<Arc<AppServerBridge>>().inner());
            let scheduler_trigger = Arc::clone(app.state::<Arc<Notify>>().inner());
            let app_handle_for_notifications = app.handle().clone();
            let automation_store_for_notifications =
                Arc::clone(app.state::<Arc<AutomationStore>>().inner());
            let app_server_bridge_for_notifications =
                Arc::clone(app.state::<Arc<AppServerBridge>>().inner());
            tauri::async_runtime::spawn(async move {
                loop {
                    let due = match automation_store.due_automations(now_ts()).await {
                        Ok(items) => items,
                        Err(error) => {
                            let _ = app_handle.emit(
                                "automation-runs-updated",
                                serde_json::json!({ "error": error }),
                            );
                            Vec::new()
                        }
                    };
                    for automation in due {
                        let _ = run_automation_record(
                            app_handle.clone(),
                            Arc::clone(&automation_store),
                            Arc::clone(&app_server_bridge),
                            automation,
                        )
                        .await;
                    }

                    let now = now_ts();
                    let sleep_seconds = match automation_store.next_due_timestamp().await {
                        Ok(Some(next_due)) if next_due > now => (next_due - now).min(300),
                        Ok(Some(_)) => 1,
                        Ok(None) => 60,
                        Err(error) => {
                            let _ = app_handle.emit(
                                "automation-runs-updated",
                                serde_json::json!({ "error": error }),
                            );
                            15
                        }
                    };
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(sleep_seconds as u64)) => {}
                        _ = scheduler_trigger.notified() => {}
                    }
                }
            });
            tauri::async_runtime::spawn(async move {
                let mut notifications =
                    app_server_bridge_for_notifications.subscribe_notifications();
                loop {
                    let notification = match notifications.recv().await {
                        Ok(message) => message,
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    };
                    if let Err(error) = reconcile_automation_run_completion(
                        app_handle_for_notifications.clone(),
                        Arc::clone(&automation_store_for_notifications),
                        notification,
                    )
                    .await
                    {
                        let _ = app_handle_for_notifications.emit(
                            "automation-runs-updated",
                            serde_json::json!({ "error": error }),
                        );
                    }
                }
            });
            Ok(())
        })
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
            git_apply_patch,
            persisted_atom_sync,
            persisted_atom_update,
            persisted_atom_reset,
            automation_list,
            automation_create,
            automation_update,
            automation_delete,
            automation_run_now,
            automation_runs_list,
            automation_run_archive,
            inbox_items,
            inbox_mark_read,
            terminal_list,
            terminal_create,
            terminal_attach,
            terminal_write,
            terminal_resize,
            terminal_close,
            cloud_run_start,
            cloud_run_cancel,
            cloud_run_list,
            bridge_get_build_flavor,
            host_get_renderer_mode,
            bridge_message_from_view,
            bridge_get_sentry_init_options,
            bridge_trigger_sentry_test,
            bridge_send_message_from_view,
            bridge_send_worker_message_from_view,
            bridge_show_context_menu,
            host_get_update_state,
            host_check_updates,
            host_dispatch_deeplink,
            host_open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
