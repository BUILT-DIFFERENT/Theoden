use crate::app_server_bridge::{
    build_prepended_path, configure_command_for_desktop, resolve_codex_cli_command,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

const MAX_STORED_RUNS: usize = 100;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunStartParams {
    pub thread_id: String,
    pub prompt: String,
    pub environment_id: String,
    pub branch: Option<String>,
    pub attempts: Option<u32>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunCancelParams {
    pub run_id: Option<String>,
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunDescriptor {
    pub run_id: String,
    pub thread_id: String,
    pub task_id: Option<String>,
    pub url: Option<String>,
    pub environment_id: String,
    pub branch: Option<String>,
    pub attempts: u32,
    pub cwd: Option<String>,
    pub status: String,
    pub started_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunStatusEvent {
    pub run_id: String,
    pub thread_id: String,
    pub status: String,
    pub detail: Option<String>,
    pub task_id: Option<String>,
    pub url: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunOutputEvent {
    pub run_id: String,
    pub thread_id: String,
    pub stream: String,
    pub data: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudRunCompletedEvent {
    pub run_id: String,
    pub thread_id: String,
    pub status: String,
    pub code: i32,
    pub error: Option<String>,
    pub task_id: Option<String>,
    pub url: Option<String>,
    pub completed_at: i64,
}

#[derive(Debug, Clone)]
struct CloudRunRecord {
    descriptor: CloudRunDescriptor,
    cancel_requested: bool,
}

#[derive(Default)]
pub struct CloudRunHost {
    runs: Arc<Mutex<HashMap<String, CloudRunRecord>>>,
    active_children: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
}

impl CloudRunHost {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn list(&self) -> Vec<CloudRunDescriptor> {
        let runs = self.runs.lock().await;
        let mut output = runs
            .values()
            .map(|record| record.descriptor.clone())
            .collect::<Vec<_>>();
        output.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        output
    }

    pub async fn start(
        &self,
        app: AppHandle,
        params: CloudRunStartParams,
    ) -> Result<CloudRunDescriptor, String> {
        let thread_id = params.thread_id.trim().to_string();
        if thread_id.is_empty() {
            return Err("threadId is required".to_string());
        }
        let prompt = params.prompt.trim().to_string();
        if prompt.is_empty() {
            return Err("prompt is required".to_string());
        }
        let environment_id = params.environment_id.trim().to_string();
        if environment_id.is_empty() {
            return Err("environmentId is required".to_string());
        }
        let attempts = params.attempts.unwrap_or(1).clamp(1, 4);

        if let Some(existing_run_id) = self.find_active_run_id_by_thread(&thread_id).await {
            let _ = self
                .cancel(
                    app.clone(),
                    CloudRunCancelParams {
                        run_id: Some(existing_run_id),
                        thread_id: None,
                    },
                )
                .await;
        }

        let codex_command = resolve_codex_cli_command()?;
        let mut command = Command::new(codex_command.program);
        configure_command_for_desktop(&mut command);
        command
            .arg("cloud")
            .arg("exec")
            .arg("--env")
            .arg(&environment_id)
            .arg("--attempts")
            .arg(attempts.to_string());
        if let Some(branch) = params.branch.as_ref().map(|value| value.trim()) {
            if !branch.is_empty() {
                command.arg("--branch").arg(branch.to_string());
            }
        }
        command.arg(&prompt);
        if let Some(cwd) = params.cwd.clone() {
            command.current_dir(cwd);
        }
        if let Some(path) =
            build_prepended_path(&codex_command.prepended_path_entries, std::env::var_os("PATH"))
        {
            command.env("PATH", path);
        }
        command
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let child = command
            .spawn()
            .map_err(|err| format!("failed to start cloud run: {err}"))?;

        let run_id = format!("cloud-run-{}", Uuid::new_v4());
        let now = now_ts();
        let descriptor = CloudRunDescriptor {
            run_id: run_id.clone(),
            thread_id: thread_id.clone(),
            task_id: None,
            url: None,
            environment_id,
            branch: params.branch.clone(),
            attempts,
            cwd: params.cwd.clone(),
            status: "queued".to_string(),
            started_at: now,
            updated_at: now,
        };

        {
            let mut runs = self.runs.lock().await;
            runs.insert(
                run_id.clone(),
                CloudRunRecord {
                    descriptor: descriptor.clone(),
                    cancel_requested: false,
                },
            );
            trim_completed_runs(&mut runs);
        }

        let child_handle = Arc::new(Mutex::new(child));
        self.active_children
            .lock()
            .await
            .insert(run_id.clone(), Arc::clone(&child_handle));

        let _ = app.emit("cloud-run-started", &descriptor);

        let runs = Arc::clone(&self.runs);
        let children = Arc::clone(&self.active_children);
        tauri::async_runtime::spawn(async move {
            monitor_cloud_run(app, runs, children, run_id, child_handle).await;
        });

        Ok(descriptor)
    }

    pub async fn cancel(
        &self,
        app: AppHandle,
        params: CloudRunCancelParams,
    ) -> Result<bool, String> {
        let Some(run_id) = self.resolve_run_id(params).await else {
            return Ok(false);
        };

        {
            let mut runs = self.runs.lock().await;
            let Some(record) = runs.get_mut(&run_id) else {
                return Ok(false);
            };
            record.cancel_requested = true;
            record.descriptor.status = "interrupted".to_string();
            record.descriptor.updated_at = now_ts();
            let _ = app.emit(
                "cloud-run-status",
                CloudRunStatusEvent {
                    run_id: record.descriptor.run_id.clone(),
                    thread_id: record.descriptor.thread_id.clone(),
                    status: "interrupted".to_string(),
                    detail: Some("Cancellation requested.".to_string()),
                    task_id: record.descriptor.task_id.clone(),
                    url: record.descriptor.url.clone(),
                    updated_at: record.descriptor.updated_at,
                },
            );
        }

        let child = {
            let children = self.active_children.lock().await;
            children.get(&run_id).cloned()
        };
        if let Some(child) = child {
            let mut guard = child.lock().await;
            guard
                .kill()
                .await
                .map_err(|err| format!("failed to cancel cloud run: {err}"))?;
        }
        Ok(true)
    }

    async fn resolve_run_id(&self, params: CloudRunCancelParams) -> Option<String> {
        if let Some(run_id) = params
            .run_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            return Some(run_id.to_string());
        }
        let thread_id = params
            .thread_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())?
            .to_string();
        self.find_active_run_id_by_thread(&thread_id).await
    }

    async fn find_active_run_id_by_thread(&self, thread_id: &str) -> Option<String> {
        let runs = self.runs.lock().await;
        runs.values()
            .find(|record| {
                record.descriptor.thread_id == thread_id
                    && matches!(
                        record.descriptor.status.as_str(),
                        "queued" | "running" | "interrupted"
                    )
            })
            .map(|record| record.descriptor.run_id.clone())
    }
}

async fn monitor_cloud_run(
    app: AppHandle,
    runs: Arc<Mutex<HashMap<String, CloudRunRecord>>>,
    active_children: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
    run_id: String,
    child: Arc<Mutex<Child>>,
) {
    let (thread_id, mut task_id, mut url) = {
        let mut guard = runs.lock().await;
        let Some(record) = guard.get_mut(&run_id) else {
            return;
        };
        record.descriptor.status = "running".to_string();
        record.descriptor.updated_at = now_ts();
        let thread_id = record.descriptor.thread_id.clone();
        let task_id = record.descriptor.task_id.clone();
        let url = record.descriptor.url.clone();
        let _ = app.emit(
            "cloud-run-status",
            CloudRunStatusEvent {
                run_id: run_id.clone(),
                thread_id: thread_id.clone(),
                status: "running".to_string(),
                detail: Some("Cloud run started.".to_string()),
                task_id: task_id.clone(),
                url: url.clone(),
                updated_at: record.descriptor.updated_at,
            },
        );
        (thread_id, task_id, url)
    };

    let (mut stdout, mut stderr) = {
        let mut locked_child = child.lock().await;
        (locked_child.stdout.take(), locked_child.stderr.take())
    };

    let (output_tx, mut output_rx) = mpsc::unbounded_channel::<(String, String)>();
    let output_tx_stdout = output_tx.clone();
    let stdout_task = tauri::async_runtime::spawn(async move {
        if let Some(stdout_pipe) = stdout.take() {
            let mut lines = BufReader::new(stdout_pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = output_tx_stdout.send(("stdout".to_string(), line));
            }
        }
    });
    let output_tx_stderr = output_tx.clone();
    let stderr_task = tauri::async_runtime::spawn(async move {
        if let Some(stderr_pipe) = stderr.take() {
            let mut lines = BufReader::new(stderr_pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = output_tx_stderr.send(("stderr".to_string(), line));
            }
        }
    });
    drop(output_tx);

    while let Some((stream, line)) = output_rx.recv().await {
        let now = now_ts();
        if task_id.is_none() {
            if let Some(parsed_task_id) = task_id_from_cloud_url(&line) {
                task_id = Some(parsed_task_id);
                url = Some(line.trim().to_string());
                let mut guard = runs.lock().await;
                if let Some(record) = guard.get_mut(&run_id) {
                    record.descriptor.task_id = task_id.clone();
                    record.descriptor.url = url.clone();
                    record.descriptor.updated_at = now;
                    let _ = app.emit(
                        "cloud-run-status",
                        CloudRunStatusEvent {
                            run_id: run_id.clone(),
                            thread_id: thread_id.clone(),
                            status: "running".to_string(),
                            detail: Some("Cloud task accepted.".to_string()),
                            task_id: task_id.clone(),
                            url: url.clone(),
                            updated_at: now,
                        },
                    );
                }
            }
        }

        let _ = app.emit(
            "cloud-run-output",
            CloudRunOutputEvent {
                run_id: run_id.clone(),
                thread_id: thread_id.clone(),
                stream,
                data: line,
                updated_at: now,
            },
        );
    }

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let exit_code = {
        let mut locked_child = child.lock().await;
        match locked_child.wait().await {
            Ok(status) => status.code().unwrap_or(-1),
            Err(_) => -1,
        }
    };

    let (status, detail, completed_event) = {
        let mut guard = runs.lock().await;
        let Some(record) = guard.get_mut(&run_id) else {
            return;
        };
        let completed_at = now_ts();
        let status = terminal_status(exit_code, record.cancel_requested);
        record.descriptor.status = status.clone();
        record.descriptor.updated_at = completed_at;
        let detail = if status == "completed" {
            Some("Cloud run completed.".to_string())
        } else if status == "interrupted" {
            Some("Cloud run interrupted.".to_string())
        } else {
            Some("Cloud run failed.".to_string())
        };
        let completed_event = CloudRunCompletedEvent {
            run_id: run_id.clone(),
            thread_id: thread_id.clone(),
            status: status.clone(),
            code: exit_code,
            error: if status == "failed" {
                Some(format!("cloud command exited with code {exit_code}"))
            } else {
                None
            },
            task_id: record.descriptor.task_id.clone(),
            url: record.descriptor.url.clone(),
            completed_at,
        };
        (status, detail, completed_event)
    };

    active_children.lock().await.remove(&run_id);

    let _ = app.emit(
        "cloud-run-status",
        CloudRunStatusEvent {
            run_id: run_id.clone(),
            thread_id: thread_id.clone(),
            status: status.clone(),
            detail,
            task_id,
            url,
            updated_at: now_ts(),
        },
    );
    let _ = app.emit("cloud-run-completed", completed_event);
}

fn trim_completed_runs(runs: &mut HashMap<String, CloudRunRecord>) {
    if runs.len() <= MAX_STORED_RUNS {
        return;
    }
    let mut records = runs
        .iter()
        .map(|(run_id, record)| (run_id.clone(), record.descriptor.updated_at))
        .collect::<Vec<_>>();
    records.sort_by(|a, b| b.1.cmp(&a.1));
    let keep = records
        .into_iter()
        .take(MAX_STORED_RUNS)
        .map(|entry| entry.0)
        .collect::<std::collections::HashSet<_>>();
    runs.retain(|run_id, _| keep.contains(run_id));
}

fn terminal_status(exit_code: i32, cancel_requested: bool) -> String {
    if cancel_requested {
        return "interrupted".to_string();
    }
    if exit_code == 0 {
        return "completed".to_string();
    }
    "failed".to_string()
}

fn task_id_from_cloud_url(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let parsed = url::Url::parse(trimmed).ok()?;
    let segments = parsed.path_segments()?.collect::<Vec<_>>();
    segments.last().map(|value| value.to_string())
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        now_ts, task_id_from_cloud_url, terminal_status, trim_completed_runs, CloudRunDescriptor,
        CloudRunHost, CloudRunRecord,
    };
    use std::collections::HashMap;

    #[test]
    fn parses_task_id_from_cloud_url() {
        assert_eq!(
            task_id_from_cloud_url("https://cloud.example/tasks/task-123"),
            Some("task-123".to_string())
        );
        assert_eq!(task_id_from_cloud_url("not-a-url"), None);
    }

    #[test]
    fn maps_terminal_status_with_cancellation_precedence() {
        assert_eq!(terminal_status(0, false), "completed");
        assert_eq!(terminal_status(1, false), "failed");
        assert_eq!(terminal_status(0, true), "interrupted");
    }

    #[tokio::test]
    async fn lists_cloud_runs_sorted_by_updated_at_desc() {
        let host = CloudRunHost::new();
        let now = now_ts();
        {
            let mut runs = host.runs.lock().await;
            runs.insert(
                "r1".to_string(),
                CloudRunRecord {
                    descriptor: test_descriptor("r1", "t1", now - 50),
                    cancel_requested: false,
                },
            );
            runs.insert(
                "r2".to_string(),
                CloudRunRecord {
                    descriptor: test_descriptor("r2", "t2", now),
                    cancel_requested: false,
                },
            );
            runs.insert(
                "r3".to_string(),
                CloudRunRecord {
                    descriptor: test_descriptor("r3", "t3", now - 10),
                    cancel_requested: false,
                },
            );
        }

        let listed = host.list().await;
        let run_ids = listed
            .into_iter()
            .map(|descriptor| descriptor.run_id)
            .collect::<Vec<_>>();
        assert_eq!(
            run_ids,
            vec!["r2".to_string(), "r3".to_string(), "r1".to_string()]
        );
    }

    #[test]
    fn trims_stored_runs_to_maximum_capacity() {
        let mut runs = HashMap::new();
        for index in 0..120 {
            let run_id = format!("run-{index}");
            runs.insert(
                run_id.clone(),
                CloudRunRecord {
                    descriptor: test_descriptor(&run_id, "thread-1", 1_000 + index),
                    cancel_requested: false,
                },
            );
        }

        trim_completed_runs(&mut runs);

        assert_eq!(runs.len(), 100);
        assert!(!runs.contains_key("run-0"));
        assert!(runs.contains_key("run-119"));
    }

    fn test_descriptor(run_id: &str, thread_id: &str, updated_at: i64) -> CloudRunDescriptor {
        CloudRunDescriptor {
            run_id: run_id.to_string(),
            thread_id: thread_id.to_string(),
            task_id: None,
            url: None,
            environment_id: "default".to_string(),
            branch: None,
            attempts: 1,
            cwd: None,
            status: "running".to_string(),
            started_at: updated_at,
            updated_at,
        }
    }
}
