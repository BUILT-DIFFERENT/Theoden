use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize, SlavePty};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

const EXIT_MARKER_PREFIX: &str = "__CODEX_EXIT__";

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
    pub raw: Option<bool>,
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
struct TerminalSessionState {
    is_running: bool,
    pending_markers: VecDeque<String>,
    updated_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ShellKind {
    #[cfg(target_os = "windows")]
    Cmd,
    #[cfg(target_os = "windows")]
    Pwsh,
    #[cfg(not(target_os = "windows"))]
    Posix,
}

#[derive(Debug, Clone)]
struct ShellLaunch {
    program: String,
    args: Vec<String>,
    kind: ShellKind,
}

struct TerminalSession {
    session_id: String,
    thread_id: Option<String>,
    workspace_path: Option<String>,
    cwd: Option<String>,
    interactive: bool,
    supports_resize: bool,
    mode: String,
    state: Arc<StdMutex<TerminalSessionState>>,
    writer_tx: mpsc::UnboundedSender<Vec<u8>>,
    master: Arc<StdMutex<Box<dyn MasterPty + Send>>>,
    killer: Arc<StdMutex<Box<dyn ChildKiller + Send + Sync>>>,
    _slave: Arc<StdMutex<Option<Box<dyn SlavePty + Send>>>>,
    reader_task: tokio::task::JoinHandle<()>,
    writer_task: tokio::task::JoinHandle<()>,
    wait_task: tokio::task::JoinHandle<()>,
    shell_kind: ShellKind,
}

#[derive(Default)]
pub struct TerminalHost {
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
}

impl TerminalHost {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn list(&self) -> Vec<TerminalSessionDescriptor> {
        let sessions = self.sessions.lock().await;
        let mut output = sessions
            .values()
            .map(|session| to_descriptor(session))
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
        let session = spawn_terminal_session(app.clone(), session_id, params)?;
        let descriptor = to_descriptor(&session);
        self.sessions
            .lock()
            .await
            .insert(session.session_id.clone(), session);
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
            .ok_or_else(|| "terminal session not found".to_string())?;
        let descriptor = to_descriptor(session);
        let _ = app.emit("terminal-attached", &descriptor);
        Ok(descriptor)
    }

    pub async fn write(&self, _app: AppHandle, params: TerminalWriteParams) -> Result<(), String> {
        let session = {
            let sessions = self.sessions.lock().await;
            sessions
                .get(&params.session_id)
                .cloned()
                .ok_or_else(|| "terminal session not found".to_string())?
        };

        if params.raw.unwrap_or(false) {
            if params.input.is_empty() {
                return Ok(());
            }
            session
                .writer_tx
                .send(params.input.into_bytes())
                .map_err(|_| "terminal session writer is closed".to_string())?;
            if let Ok(mut state) = session.state.lock() {
                state.updated_at = now_ts();
            }
            return Ok(());
        }

        if params.input.trim().is_empty() {
            return Err("command input was empty".to_string());
        }

        let marker = Uuid::new_v4().to_string();
        if let Ok(mut state) = session.state.lock() {
            state.pending_markers.push_back(marker.clone());
            state.is_running = true;
            state.updated_at = now_ts();
        }

        let payload = build_write_payload(&params.input, session.shell_kind, &marker);
        session
            .writer_tx
            .send(payload)
            .map_err(|_| "terminal session writer is closed".to_string())?;
        Ok(())
    }

    pub async fn resize(&self, params: TerminalResizeParams) -> Result<(), String> {
        let session = {
            let sessions = self.sessions.lock().await;
            sessions
                .get(&params.session_id)
                .cloned()
                .ok_or_else(|| "terminal session not found".to_string())?
        };

        {
            let master = session
                .master
                .lock()
                .map_err(|_| "terminal session mutex poisoned".to_string())?;
            master
                .resize(PtySize {
                    rows: params.rows.max(1),
                    cols: params.cols.max(1),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|err| format!("failed to resize terminal: {err}"))?;
        }
        if let Ok(mut state) = session.state.lock() {
            state.updated_at = now_ts();
        }
        Ok(())
    }

    pub async fn close(&self, params: TerminalCloseParams) -> Result<(), String> {
        let session = self.sessions.lock().await.remove(&params.session_id);
        if let Some(session) = session {
            terminate_session(&session);
        }
        Ok(())
    }
}

fn spawn_terminal_session(
    app: AppHandle,
    session_id: String,
    params: TerminalCreateParams,
) -> Result<Arc<TerminalSession>, String> {
    let shell = resolve_shell()?;
    let mut command = CommandBuilder::new(shell.program.clone());
    for arg in &shell.args {
        command.arg(arg);
    }

    let cwd = params.cwd.or(params.workspace_path.clone());
    if let Some(cwd_path) = &cwd {
        command.cwd(Path::new(cwd_path));
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("failed to open PTY: {err}"))?;
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| format!("failed to start terminal shell: {err}"))?;

    let killer = child.clone_killer();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("failed to clone PTY reader: {err}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("failed to acquire PTY writer: {err}"))?;
    let master = pair.master;
    let slave = pair.slave;

    let state = Arc::new(StdMutex::new(TerminalSessionState {
        is_running: false,
        pending_markers: VecDeque::new(),
        updated_at: now_ts(),
    }));
    let writer = Arc::new(StdMutex::new(writer));
    let (writer_tx, mut writer_rx) = mpsc::unbounded_channel::<Vec<u8>>();

    let writer_task = tokio::spawn({
        let writer = Arc::clone(&writer);
        async move {
            while let Some(bytes) = writer_rx.recv().await {
                if let Ok(mut guard) = writer.lock() {
                    let _ = guard.write_all(&bytes);
                    let _ = guard.flush();
                } else {
                    return;
                }
            }
        }
    });

    let reader_state = Arc::clone(&state);
    let reader_app = app.clone();
    let reader_session_id = session_id.clone();
    let reader_task = tokio::task::spawn_blocking(move || {
        let mut buffer = [0_u8; 8192];
        let mut line_buffer = String::new();
        loop {
            let read = match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => size,
                Err(_) => break,
            };
            let chunk = String::from_utf8_lossy(&buffer[..read]);
            line_buffer.push_str(&chunk);

            while let Some(newline_index) = line_buffer.find('\n') {
                let line = line_buffer[..newline_index]
                    .trim_end_matches('\r')
                    .to_string();
                line_buffer.drain(..=newline_index);

                if let Some((token, code)) = parse_exit_marker(&line) {
                    if consume_pending_marker(&reader_state, &token) {
                        let _ = reader_app.emit(
                            "terminal-exit",
                            serde_json::json!({
                                "sessionId": reader_session_id,
                                "code": code
                            }),
                        );
                        continue;
                    }
                }

                let _ = reader_app.emit(
                    "terminal-data",
                    serde_json::json!({
                        "sessionId": reader_session_id,
                        "stream": "stdout",
                        "data": line
                    }),
                );
            }
        }

        let leftover = line_buffer.trim_end_matches('\r').to_string();
        if !leftover.is_empty() {
            if let Some((token, code)) = parse_exit_marker(&leftover) {
                if consume_pending_marker(&reader_state, &token) {
                    let _ = reader_app.emit(
                        "terminal-exit",
                        serde_json::json!({
                            "sessionId": reader_session_id,
                            "code": code
                        }),
                    );
                    return;
                }
            }
            let _ = reader_app.emit(
                "terminal-data",
                serde_json::json!({
                    "sessionId": reader_session_id,
                    "stream": "stdout",
                    "data": leftover
                }),
            );
        }
    });

    let wait_state = Arc::clone(&state);
    let wait_app = app.clone();
    let wait_session_id = session_id.clone();
    let wait_task = tokio::task::spawn_blocking(move || {
        let code = match child.wait() {
            Ok(status) => status.exit_code() as i32,
            Err(_) => -1,
        };
        if let Ok(mut session_state) = wait_state.lock() {
            session_state.is_running = false;
            session_state.pending_markers.clear();
            session_state.updated_at = now_ts();
        }
        let _ = wait_app.emit(
            "terminal-exit",
            serde_json::json!({
                "sessionId": wait_session_id,
                "code": code
            }),
        );
    });

    Ok(Arc::new(TerminalSession {
        session_id,
        thread_id: params.thread_id,
        workspace_path: params.workspace_path,
        cwd,
        interactive: true,
        supports_resize: true,
        mode: "pty".to_string(),
        state,
        writer_tx,
        master: Arc::new(StdMutex::new(master)),
        killer: Arc::new(StdMutex::new(killer)),
        _slave: Arc::new(StdMutex::new(Some(slave))),
        reader_task,
        writer_task,
        wait_task,
        shell_kind: shell.kind,
    }))
}

fn resolve_shell() -> Result<ShellLaunch, String> {
    #[cfg(target_os = "windows")]
    {
        if which::which("pwsh").is_ok() {
            return Ok(ShellLaunch {
                program: "pwsh".to_string(),
                args: vec!["-NoLogo".to_string()],
                kind: ShellKind::Pwsh,
            });
        }
        Ok(ShellLaunch {
            program: "cmd.exe".to_string(),
            args: Vec::new(),
            kind: ShellKind::Cmd,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            let trimmed = shell.trim();
            if !trimmed.is_empty() && (Path::new(trimmed).exists() || which::which(trimmed).is_ok())
            {
                return Ok(ShellLaunch {
                    program: trimmed.to_string(),
                    args: vec!["-l".to_string()],
                    kind: ShellKind::Posix,
                });
            }
        }
        if Path::new("/bin/bash").exists() {
            return Ok(ShellLaunch {
                program: "/bin/bash".to_string(),
                args: vec!["-l".to_string()],
                kind: ShellKind::Posix,
            });
        }
        if Path::new("/bin/sh").exists() {
            return Ok(ShellLaunch {
                program: "/bin/sh".to_string(),
                args: vec!["-l".to_string()],
                kind: ShellKind::Posix,
            });
        }
        Err("failed to resolve a compatible terminal shell".to_string())
    }
}

fn build_write_payload(input: &str, shell_kind: ShellKind, marker: &str) -> Vec<u8> {
    let newline = if cfg!(windows) { "\r\n" } else { "\n" };
    let mut payload = String::new();
    payload.push_str(input);
    if !(input.ends_with('\n') || input.ends_with('\r')) {
        payload.push_str(newline);
    }
    payload.push_str(&marker_command(shell_kind, marker));
    payload.push_str(newline);
    payload.into_bytes()
}

fn marker_command(shell_kind: ShellKind, marker: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        match shell_kind {
            ShellKind::Cmd => format!("echo {EXIT_MARKER_PREFIX}{marker}:%errorlevel%"),
            ShellKind::Pwsh => format!(
                "$__codexExit = if ($LASTEXITCODE -is [int]) {{ $LASTEXITCODE }} elseif ($?) {{ 0 }} else {{ 1 }}; Write-Output \"{EXIT_MARKER_PREFIX}{marker}:$__codexExit\""
            ),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        match shell_kind {
            ShellKind::Posix => {
                format!("printf '{EXIT_MARKER_PREFIX}{marker}:%s\\n' \"$?\"")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{build_write_payload, parse_exit_marker, ShellKind, EXIT_MARKER_PREFIX};

    #[test]
    fn parses_exit_markers_with_prefix() {
        let marker = format!("{EXIT_MARKER_PREFIX}abc123:17");
        let parsed = parse_exit_marker(&marker);
        assert_eq!(parsed, Some(("abc123".to_string(), 17)));
    }

    #[test]
    fn ignores_invalid_marker_payloads() {
        assert_eq!(parse_exit_marker("hello"), None);
        assert_eq!(
            parse_exit_marker(&format!("{EXIT_MARKER_PREFIX}abc:not-a-number")),
            None
        );
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn write_payload_contains_command_and_exit_marker() {
        let payload = build_write_payload("echo parity", ShellKind::Posix, "token-1");
        let output = String::from_utf8(payload).expect("payload should be UTF-8");
        assert!(output.contains("echo parity"));
        assert!(output.contains(&format!("{EXIT_MARKER_PREFIX}token-1")));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn write_payload_contains_command_and_exit_marker() {
        let payload = build_write_payload("echo parity", ShellKind::Cmd, "token-1");
        let output = String::from_utf8(payload).expect("payload should be UTF-8");
        assert!(output.contains("echo parity"));
        assert!(output.contains(&format!("{EXIT_MARKER_PREFIX}token-1")));
    }
}

fn parse_exit_marker(line: &str) -> Option<(String, i32)> {
    let marker_index = line.find(EXIT_MARKER_PREFIX)?;
    let payload = &line[marker_index + EXIT_MARKER_PREFIX.len()..];
    let mut parts = payload.splitn(2, ':');
    let token = parts.next()?.trim();
    if token.is_empty() {
        return None;
    }
    let code_text = parts.next()?.trim();
    let numeric = code_text
        .chars()
        .take_while(|char| *char == '-' || char.is_ascii_digit())
        .collect::<String>();
    if numeric.is_empty() {
        return None;
    }
    let code = numeric.parse::<i32>().ok()?;
    Some((token.to_string(), code))
}

fn consume_pending_marker(state: &Arc<StdMutex<TerminalSessionState>>, token: &str) -> bool {
    if let Ok(mut session_state) = state.lock() {
        if let Some(position) = session_state
            .pending_markers
            .iter()
            .position(|entry| entry == token)
        {
            session_state.pending_markers.remove(position);
            session_state.is_running = !session_state.pending_markers.is_empty();
            session_state.updated_at = now_ts();
            return true;
        }
    }
    false
}

fn terminate_session(session: &TerminalSession) {
    if let Ok(mut killer) = session.killer.lock() {
        let _ = killer.kill();
    }
    session.reader_task.abort();
    session.writer_task.abort();
    session.wait_task.abort();
}

fn to_descriptor(session: &TerminalSession) -> TerminalSessionDescriptor {
    let (is_running, updated_at) = if let Ok(state) = session.state.lock() {
        (state.is_running, state.updated_at)
    } else {
        (false, now_ts())
    };
    TerminalSessionDescriptor {
        session_id: session.session_id.clone(),
        thread_id: session.thread_id.clone(),
        workspace_path: session.workspace_path.clone(),
        cwd: session.cwd.clone(),
        is_running,
        interactive: session.interactive,
        supports_resize: session.supports_resize,
        mode: session.mode.clone(),
        updated_at,
    }
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
