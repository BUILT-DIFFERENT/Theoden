use crate::app_server_bridge::configure_command_for_desktop;
use crate::electron_compat::{HostError, WorkerRequest, WorkerResponse};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::path::Path;
use tokio::fs;
use tokio::process::Command;
use uuid::Uuid;

pub const GIT_WORKER_METHODS: &[&str] = &[
    "apply-changes",
    "base-branch",
    "branch-ahead-count",
    "branch-changes",
    "cat-file",
    "codex-worktree",
    "commit",
    "config-value",
    "create-worktree",
    "current-branch",
    "default-branch",
    "delete-worktree",
    "git-init-repo",
    "index-info",
    "invalidate-stable-metadata",
    "list-worktrees",
    "recent-branches",
    "restore-worktree",
    "set-config-value",
    "stable-metadata",
    "staged-and-unstaged-changes",
    "status-summary",
    "submodule-paths",
    "tracked-uncommitted-changes",
    "untracked-changes",
    "upstream-branch",
    "worktree-snapshot-ref",
];

pub fn is_known_worker_method(method: &str) -> bool {
    GIT_WORKER_METHODS.contains(&method)
}

pub async fn handle_git_worker(request: WorkerRequest) -> WorkerResponse {
    match handle_git_worker_inner(&request).await {
        Ok(result) => WorkerResponse {
            worker_id: request.worker_id,
            request_id: request.request_id,
            ok: true,
            result: Some(result),
            error: None,
        },
        Err(error) => WorkerResponse {
            worker_id: request.worker_id,
            request_id: request.request_id,
            ok: false,
            result: None,
            error: Some(HostError {
                code: "git_worker_error".to_string(),
                message: error,
                details: None,
            }),
        },
    }
}

async fn handle_git_worker_inner(request: &WorkerRequest) -> Result<Value, String> {
    if !is_known_worker_method(&request.method) {
        return Err(format!(
            "unsupported git worker method '{}'",
            request.method
        ));
    }

    let cwd = request
        .params
        .get("cwd")
        .and_then(Value::as_str)
        .unwrap_or(".");

    match request.method.as_str() {
        "stable-metadata" => {
            let current_branch = current_branch(cwd)
                .await
                .unwrap_or_else(|_| "HEAD".to_string());
            let upstream = upstream_branch(cwd).await.ok();
            let ahead = branch_ahead_count(cwd).await.unwrap_or(0);
            let status_lines = status_lines(cwd).await.unwrap_or_default();
            Ok(json!({
              "currentBranch": current_branch,
              "upstreamBranch": upstream,
              "branchAheadCount": ahead,
              "statusSummary": {
                "changedCount": status_lines.len(),
                "lines": status_lines
              }
            }))
        }
        "current-branch" => {
            let branch = current_branch(cwd).await?;
            Ok(json!({ "branch": branch.trim() }))
        }
        "upstream-branch" => {
            let branch = upstream_branch(cwd).await.ok();
            Ok(json!({ "branch": branch }))
        }
        "branch-ahead-count" => {
            let count = branch_ahead_count(cwd).await.unwrap_or(0);
            Ok(json!({ "count": count }))
        }
        "default-branch" => {
            let branch = default_branch(cwd)
                .await
                .unwrap_or_else(|_| "main".to_string());
            Ok(json!({ "branch": branch }))
        }
        "base-branch" => {
            let branch = request
                .params
                .get("baseBranch")
                .or_else(|| request.params.get("base_branch"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
                .unwrap_or_else(|| "main".to_string());
            Ok(json!({ "branch": branch }))
        }
        "recent-branches" => {
            let limit = request
                .params
                .get("limit")
                .and_then(Value::as_u64)
                .unwrap_or(20);
            let output = run_git(
                cwd,
                &[
                    "for-each-ref",
                    "--sort=-committerdate",
                    "--format=%(refname:short)\t%(committerdate:iso8601)",
                    "refs/heads",
                ],
            )
            .await?;
            let items: Vec<Value> = output
                .lines()
                .take(limit as usize)
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let mut parts = line.splitn(2, '\t');
                    let branch = parts.next().unwrap_or_default().to_string();
                    let committer_date = parts.next().unwrap_or_default().to_string();
                    json!({
                      "branch": branch,
                      "committerDate": committer_date
                    })
                })
                .collect();
            Ok(json!({ "items": items }))
        }
        "branch-changes" => {
            let base = request
                .params
                .get("baseBranch")
                .or_else(|| request.params.get("base_branch"))
                .and_then(Value::as_str)
                .unwrap_or("main");
            let range = format!("{base}...HEAD");
            let output = run_git(cwd, &["diff", "--name-status", &range]).await?;
            let items: Vec<Value> = output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let mut parts = line.splitn(2, '\t');
                    let status = parts.next().unwrap_or_default().to_string();
                    let path = parts.next().unwrap_or_default().to_string();
                    json!({ "status": status, "path": path })
                })
                .collect();
            Ok(json!({ "base": base, "items": items }))
        }
        "status-summary" => {
            let lines = status_lines(cwd).await?;
            Ok(json!({
              "changedCount": lines.len(),
              "lines": lines
            }))
        }
        "staged-and-unstaged-changes" => {
            let output = run_git(cwd, &["status", "--porcelain"]).await?;
            let items: Vec<Value> = output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let status = line.get(0..2).unwrap_or("").trim().to_string();
                    let path = line.get(3..).unwrap_or("").trim().to_string();
                    json!({ "status": status, "path": path })
                })
                .collect();
            Ok(json!({ "items": items }))
        }
        "untracked-changes" => {
            let output = run_git(cwd, &["ls-files", "--others", "--exclude-standard"]).await?;
            let items = output
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>();
            Ok(json!({ "items": items }))
        }
        "tracked-uncommitted-changes" => {
            let staged = run_git(cwd, &["diff", "--cached", "--name-only"]).await?;
            let unstaged = run_git(cwd, &["diff", "--name-only"]).await?;
            let mut items = BTreeSet::new();
            for line in staged.lines().chain(unstaged.lines()) {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    items.insert(trimmed.to_string());
                }
            }
            Ok(json!({ "items": items.into_iter().collect::<Vec<_>>() }))
        }
        "submodule-paths" => {
            let output = run_git_allow_failure(cwd, &["submodule", "status", "--recursive"])
                .await
                .unwrap_or_default();
            let items: Vec<String> = output
                .lines()
                .filter_map(|line| line.split_whitespace().nth(1))
                .map(ToString::to_string)
                .collect();
            Ok(json!({ "items": items }))
        }
        "cat-file" => {
            let object = request
                .params
                .get("object")
                .or_else(|| request.params.get("sha"))
                .and_then(Value::as_str)
                .ok_or_else(|| "missing object parameter".to_string())?;
            let contents = run_git(cwd, &["cat-file", "-p", object]).await?;
            Ok(json!({ "object": object, "contents": contents }))
        }
        "index-info" => {
            let output = run_git(cwd, &["ls-files", "-s"]).await?;
            let items: Vec<Value> = output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    json!({
                      "mode": parts.first().copied().unwrap_or_default(),
                      "sha": parts.get(1).copied().unwrap_or_default(),
                      "stage": parts.get(2).copied().unwrap_or_default(),
                      "path": parts.get(3).copied().unwrap_or_default(),
                    })
                })
                .collect();
            Ok(json!({ "items": items }))
        }
        "config-value" => {
            let key = request
                .params
                .get("key")
                .and_then(Value::as_str)
                .ok_or_else(|| "missing config key".to_string())?;
            let value = run_git_allow_failure(cwd, &["config", "--get", key])
                .await
                .map(|item| item.trim().to_string());
            Ok(json!({ "key": key, "value": value }))
        }
        "set-config-value" => {
            let key = request
                .params
                .get("key")
                .and_then(Value::as_str)
                .ok_or_else(|| "missing config key".to_string())?;
            let value = request
                .params
                .get("value")
                .and_then(Value::as_str)
                .ok_or_else(|| "missing config value".to_string())?;
            run_git(cwd, &["config", key, value]).await?;
            Ok(json!({ "saved": true, "key": key }))
        }
        "create-worktree" => {
            let path = request
                .params
                .get("path")
                .or_else(|| request.params.get("worktreePath"))
                .and_then(Value::as_str)
                .ok_or_else(|| "missing worktree path".to_string())?;
            let branch = request.params.get("branch").and_then(Value::as_str);
            let base = request.params.get("base").and_then(Value::as_str);
            let create_branch = request
                .params
                .get("createBranch")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let mut args = vec!["worktree", "add"];
            if create_branch {
                args.push("-b");
                args.push(branch.unwrap_or("codex-worktree"));
            }
            args.push(path);
            if let Some(value) = if create_branch { base } else { branch.or(base) } {
                args.push(value);
            }
            run_git(cwd, &args).await?;
            Ok(json!({ "created": true, "path": path }))
        }
        "restore-worktree" => {
            let path = request
                .params
                .get("path")
                .or_else(|| request.params.get("worktreePath"))
                .and_then(Value::as_str)
                .ok_or_else(|| "missing worktree path".to_string())?;
            if Path::new(path).exists() {
                Ok(json!({ "restored": true, "path": path, "created": false }))
            } else {
                let branch = request
                    .params
                    .get("branch")
                    .and_then(Value::as_str)
                    .unwrap_or("HEAD");
                run_git(cwd, &["worktree", "add", path, branch]).await?;
                Ok(json!({ "restored": true, "path": path, "created": true }))
            }
        }
        "delete-worktree" => {
            let path = request
                .params
                .get("path")
                .or_else(|| request.params.get("worktreePath"))
                .and_then(Value::as_str)
                .ok_or_else(|| "missing worktree path".to_string())?;
            run_git(cwd, &["worktree", "remove", "--force", path]).await?;
            Ok(json!({ "removed": true, "path": path }))
        }
        "apply-changes" => {
            let patch_file = if let Some(path) =
                request.params.get("patchFile").and_then(Value::as_str)
            {
                path.to_string()
            } else if let Some(path) = request.params.get("patch_path").and_then(Value::as_str) {
                path.to_string()
            } else {
                let patch_text = request
                    .params
                    .get("patchText")
                    .or_else(|| request.params.get("patch"))
                    .and_then(Value::as_str)
                    .ok_or_else(|| "missing patch text".to_string())?;
                write_temp_patch(cwd, patch_text).await?
            };
            let mut args = vec!["apply"];
            if request
                .params
                .get("index")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--index");
            }
            args.push(&patch_file);
            run_git(cwd, &args).await?;
            Ok(json!({ "applied": true, "patchFile": patch_file }))
        }
        "commit" => {
            let message = request
                .params
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Codex commit");
            if request
                .params
                .get("addAll")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                run_git(cwd, &["add", "-A"]).await?;
            }
            let mut args = vec!["commit", "-m", message];
            if request
                .params
                .get("allowEmpty")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--allow-empty");
            }
            run_git(cwd, &args).await?;
            let commit_ref = run_git(cwd, &["rev-parse", "HEAD"]).await?;
            Ok(json!({ "committed": true, "ref": commit_ref.trim() }))
        }
        "list-worktrees" => {
            let output = run_git(cwd, &["worktree", "list", "--porcelain"]).await?;
            let mut items = Vec::<Value>::new();
            let mut current = json!({});
            for line in output.lines() {
                if line.trim().is_empty() {
                    if current != json!({}) {
                        items.push(current);
                        current = json!({});
                    }
                    continue;
                }
                if let Some(value) = line.strip_prefix("worktree ") {
                    current["path"] = json!(value);
                } else if let Some(value) = line.strip_prefix("HEAD ") {
                    current["head"] = json!(value);
                } else if let Some(value) = line.strip_prefix("branch ") {
                    current["branch"] = json!(value.trim_start_matches("refs/heads/"));
                }
            }
            if current != json!({}) {
                items.push(current);
            }
            Ok(json!({ "items": items }))
        }
        "codex-worktree" => {
            let output = run_git(cwd, &["worktree", "list", "--porcelain"]).await?;
            let items: Vec<String> = output
                .lines()
                .filter_map(|line| line.strip_prefix("worktree "))
                .map(ToString::to_string)
                .collect();
            let selected = items
                .iter()
                .find(|item| item.contains("codex"))
                .cloned()
                .or_else(|| items.first().cloned());
            Ok(json!({ "path": selected }))
        }
        "worktree-snapshot-ref" => {
            let reference = run_git(cwd, &["rev-parse", "HEAD"]).await?;
            Ok(json!({ "ref": reference.trim() }))
        }
        "git-init-repo" => {
            let cwd_path = request
                .params
                .get("cwd")
                .and_then(Value::as_str)
                .unwrap_or(cwd);
            run_git(cwd_path, &["init"]).await?;
            Ok(json!({ "initialized": true, "cwd": cwd_path }))
        }
        "invalidate-stable-metadata" => Ok(json!({ "invalidated": true })),
        _ => Err(format!(
            "unsupported git worker method '{}'",
            request.method
        )),
    }
}

async fn current_branch(cwd: &str) -> Result<String, String> {
    run_git(cwd, &["rev-parse", "--abbrev-ref", "HEAD"]).await
}

async fn upstream_branch(cwd: &str) -> Result<String, String> {
    run_git(
        cwd,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .await
}

async fn default_branch(cwd: &str) -> Result<String, String> {
    let remote_head = run_git(cwd, &["symbolic-ref", "refs/remotes/origin/HEAD"]).await?;
    Ok(remote_head
        .trim()
        .trim_start_matches("refs/remotes/origin/")
        .to_string())
}

async fn branch_ahead_count(cwd: &str) -> Result<i64, String> {
    let output = run_git(cwd, &["rev-list", "--count", "@{upstream}..HEAD"]).await?;
    output
        .trim()
        .parse::<i64>()
        .map_err(|error| format!("failed to parse branch ahead count: {error}"))
}

async fn status_lines(cwd: &str) -> Result<Vec<String>, String> {
    let output = run_git(cwd, &["status", "--porcelain"]).await?;
    Ok(output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect())
}

async fn write_temp_patch(cwd: &str, patch_text: &str) -> Result<String, String> {
    let patch_path = Path::new(cwd).join(format!("codex-patch-{}.patch", Uuid::new_v4()));
    fs::write(&patch_path, patch_text)
        .await
        .map_err(|error| format!("failed to write temporary patch file: {error}"))?;
    Ok(patch_path.to_string_lossy().to_string())
}

async fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
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

async fn run_git_allow_failure(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    configure_command_for_desktop(&mut command);
    command.current_dir(cwd);
    command.args(args);
    let output = command
        .output()
        .await
        .map_err(|error| format!("failed to run git command '{:?}': {error}", args))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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
