#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_server_bridge;
mod automation_store;
mod cloud_host;
mod paths;
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
use cloud_host::{CloudRunCancelParams, CloudRunDescriptor, CloudRunHost, CloudRunStartParams};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use state_store::StateStore;
use std::collections::HashMap;
use std::ffi::OsString;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
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

static REQUEST_NONCE: AtomicU64 = AtomicU64::new(1);

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
            cloud_run_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
