use crate::app_server_bridge::configure_command_for_desktop;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCreateParams {
    pub thread_id: Option<String>,
    pub workspace_path: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteParams {
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeParams {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCloseParams {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionDescriptor {
    pub session_id: String,
    pub thread_id: Option<String>,
    pub workspace_path: Option<String>,
    pub cwd: Option<String>,
    pub is_running: bool,
    pub interactive: bool,
    pub supports_resize: bool,
    pub mode: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
struct TerminalSession {
    session_id: String,
    thread_id: Option<String>,
    workspace_path: Option<String>,
    cwd: Option<String>,
    is_running: bool,
    interactive: bool,
    supports_resize: bool,
    mode: String,
    updated_at: i64,
}

#[derive(Default)]
pub struct TerminalHost {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalHost {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn list(&self) -> Vec<TerminalSessionDescriptor> {
        let sessions = self.sessions.lock().await;
        let mut output = sessions
            .values()
            .cloned()
            .map(to_descriptor)
            .collect::<Vec<_>>();
        output.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        output
    }

    pub async fn create(
        &self,
        app: AppHandle,
        params: TerminalCreateParams,
    ) -> Result<TerminalSessionDescriptor, String> {
        let session_id = format!("terminal-{}", Uuid::new_v4());
        let session = TerminalSession {
            session_id: session_id.clone(),
            thread_id: params.thread_id,
            workspace_path: params.workspace_path,
            cwd: params.cwd,
            is_running: false,
            interactive: false,
            supports_resize: false,
            mode: "stateless".to_string(),
            updated_at: now_ts(),
        };
        let descriptor = to_descriptor(session.clone());
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), session);
        let _ = app.emit("terminal-attached", &descriptor);
        Ok(descriptor)
    }

    pub async fn attach(
        &self,
        app: AppHandle,
        session_id: String,
    ) -> Result<TerminalSessionDescriptor, String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(&session_id)
            .cloned()
            .ok_or_else(|| "terminal session not found".to_string())?;
        let descriptor = to_descriptor(session);
        let _ = app.emit("terminal-attached", &descriptor);
        Ok(descriptor)
    }

    pub async fn write(&self, app: AppHandle, params: TerminalWriteParams) -> Result<(), String> {
        let (cwd, session_id) = {
            let mut sessions = self.sessions.lock().await;
            let session = sessions
                .get_mut(&params.session_id)
                .ok_or_else(|| "terminal session not found".to_string())?;
            if session.is_running {
                return Err("terminal session is already running a command".to_string());
            }
            session.is_running = true;
            session.updated_at = now_ts();
            (session.cwd.clone(), session.session_id.clone())
        };

        let _ = app.emit(
            "terminal-data",
            serde_json::json!({
                "sessionId": session_id,
                "stream": "stdin",
                "data": format!("$ {}", params.input.trim())
            }),
        );

        let app_handle = app.clone();
        let sessions = self.sessions.clone();
        tokio::spawn(async move {
            let command_text = params.input.trim().to_string();
            if command_text.is_empty() {
                let _ = app_handle.emit(
                    "terminal-error",
                    serde_json::json!({
                        "sessionId": session_id,
                        "error": "command input was empty"
                    }),
                );
                mark_session_idle(&sessions, &session_id).await;
                return;
            }

            let mut command = if cfg!(windows) {
                let mut cmd = Command::new("cmd");
                configure_command_for_desktop(&mut cmd);
                cmd.arg("/C").arg(command_text);
                cmd
            } else {
                let mut cmd = Command::new("sh");
                cmd.arg("-lc").arg(command_text);
                cmd
            };

            if let Some(cwd) = cwd {
                command.current_dir(cwd);
            }
            command
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());
            let mut child = match command.spawn() {
                Ok(child) => child,
                Err(err) => {
                    let _ = app_handle.emit(
                        "terminal-error",
                        serde_json::json!({
                            "sessionId": session_id,
                            "error": format!("failed to start terminal command: {err}")
                        }),
                    );
                    mark_session_idle(&sessions, &session_id).await;
                    return;
                }
            };

            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            let stdout_app = app_handle.clone();
            let stderr_app = app_handle.clone();
            let stdout_session = session_id.clone();
            let stderr_session = session_id.clone();
            let stdout_task = tokio::spawn(async move {
                if let Some(stdout) = stdout {
                    let mut lines = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = stdout_app.emit(
                            "terminal-data",
                            serde_json::json!({
                                "sessionId": stdout_session,
                                "stream": "stdout",
                                "data": line
                            }),
                        );
                    }
                }
            });
            let stderr_task = tokio::spawn(async move {
                if let Some(stderr) = stderr {
                    let mut lines = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = stderr_app.emit(
                            "terminal-data",
                            serde_json::json!({
                                "sessionId": stderr_session,
                                "stream": "stderr",
                                "data": line
                            }),
                        );
                    }
                }
            });

            let code = match child.wait().await {
                Ok(status) => status.code().unwrap_or(-1),
                Err(err) => {
                    let _ = app_handle.emit(
                        "terminal-error",
                        serde_json::json!({
                            "sessionId": session_id,
                            "error": format!("terminal command failed: {err}")
                        }),
                    );
                    -1
                }
            };
            let _ = stdout_task.await;
            let _ = stderr_task.await;
            mark_session_idle(&sessions, &session_id).await;
            let _ = app_handle.emit(
                "terminal-exit",
                serde_json::json!({
                    "sessionId": session_id,
                    "code": code
                }),
            );
        });

        Ok(())
    }

    pub async fn resize(&self, params: TerminalResizeParams) -> Result<(), String> {
        let _ = (params.cols, params.rows);
        let sessions = self.sessions.lock().await;
        if !sessions.contains_key(&params.session_id) {
            return Err("terminal session not found".to_string());
        }
        Ok(())
    }

    pub async fn close(&self, params: TerminalCloseParams) -> Result<(), String> {
        self.sessions.lock().await.remove(&params.session_id);
        Ok(())
    }
}

async fn mark_session_idle(
    sessions: &Arc<Mutex<HashMap<String, TerminalSession>>>,
    session_id: &str,
) {
    if let Some(session) = sessions.lock().await.get_mut(session_id) {
        session.is_running = false;
        session.updated_at = now_ts();
    }
}

fn to_descriptor(session: TerminalSession) -> TerminalSessionDescriptor {
    TerminalSessionDescriptor {
        session_id: session.session_id,
        thread_id: session.thread_id,
        workspace_path: session.workspace_path,
        cwd: session.cwd,
        is_running: session.is_running,
        interactive: session.interactive,
        supports_resize: session.supports_resize,
        mode: session.mode,
        updated_at: session.updated_at,
    }
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
