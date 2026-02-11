use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostDeeplinkPayload {
    pub route: String,
    pub section: Option<String>,
    pub thread_id: Option<String>,
    pub task_id: Option<String>,
    pub pending_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HostUpdateStatus {
    Idle,
    Checking,
    Available,
    UpToDate,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostUpdateStatePayload {
    pub status: HostUpdateStatus,
    pub detail: Option<String>,
    pub checked_at: Option<i64>,
}

impl Default for HostUpdateStatePayload {
    fn default() -> Self {
        Self {
            status: HostUpdateStatus::Idle,
            detail: Some("Update checks are idle.".to_string()),
            checked_at: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostUpdateTransition {
    StartCheck,
    MarkAvailable,
    MarkUpToDate,
    MarkError,
    Reset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostBuildFlavorPayload {
    pub flavor: String,
    pub platform: String,
    pub channel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRendererModePayload {
    pub mode: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeMessageFromViewParams {
    pub channel: String,
    pub payload: Option<Value>,
}

pub fn parse_codex_deeplink(raw: &str) -> Result<HostDeeplinkPayload, String> {
    let parsed = Url::parse(raw).map_err(|error| format!("invalid deeplink URL: {error}"))?;
    if parsed.scheme() != "codex" {
        return Err("deeplink scheme must be codex://".to_string());
    }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let segments = parsed
        .path_segments()
        .map(|value| value.collect::<Vec<_>>())
        .unwrap_or_default();
    let query_section = parsed
        .query_pairs()
        .find(|(key, _)| key == "section")
        .map(|(_, value)| value.to_string());

    let mut payload = HostDeeplinkPayload {
        route: "/".to_string(),
        section: None,
        thread_id: None,
        task_id: None,
        pending_id: None,
    };

    match host.as_str() {
        "" | "threads" => match segments.first().copied() {
            None | Some("") | Some("new") => {
                payload.route = "/".to_string();
            }
            Some("local") => {
                let conversation_id = segments
                    .get(1)
                    .ok_or_else(|| "threads/local deeplink missing conversation id".to_string())?;
                payload.route = "/t".to_string();
                payload.thread_id = Some((*conversation_id).to_string());
            }
            Some("remote") => {
                let task_id = segments
                    .get(1)
                    .ok_or_else(|| "threads/remote deeplink missing task id".to_string())?;
                payload.route = "/remote".to_string();
                payload.task_id = Some((*task_id).to_string());
            }
            _ => return Err("unsupported threads deeplink target".to_string()),
        },
        "settings" => {
            payload.route = "/settings".to_string();
            payload.section = segments
                .first()
                .filter(|value| !value.is_empty())
                .map(|value| (*value).to_string())
                .or(query_section);
        }
        "prompts" => payload.route = "/plan-summary".to_string(),
        "skills" => payload.route = "/skills".to_string(),
        "automations" => payload.route = "/automations".to_string(),
        "login" => payload.route = "/login".to_string(),
        "welcome" | "announcement" | "first-run" => payload.route = "/welcome".to_string(),
        "select-workspace" => payload.route = "/select-workspace".to_string(),
        "files" => payload.route = "/file-preview".to_string(),
        "debug" => payload.route = "/plan-summary".to_string(),
        "local" => {
            let conversation_id = segments
                .first()
                .ok_or_else(|| "local deeplink missing conversation id".to_string())?;
            payload.route = "/t".to_string();
            payload.thread_id = Some((*conversation_id).to_string());
        }
        "thread-overlay" => {
            payload.route = "/thread-overlay".to_string();
            payload.thread_id = segments
                .first()
                .filter(|value| !value.is_empty())
                .map(|value| (*value).to_string());
        }
        "remote" => {
            let task_id = segments
                .first()
                .ok_or_else(|| "remote deeplink missing task id".to_string())?;
            payload.route = "/remote".to_string();
            payload.task_id = Some((*task_id).to_string());
        }
        "worktree-init-v2" => {
            let pending_id = segments
                .first()
                .ok_or_else(|| "worktree-init-v2 deeplink missing id".to_string())?;
            payload.route = "/worktree-init-v2".to_string();
            payload.pending_id = Some((*pending_id).to_string());
        }
        "wham" => {
            match segments.first().copied() {
                Some("accounts") if segments.get(1).copied() == Some("check") => {
                    payload.route = "/login".to_string();
                }
                Some("environments") => {
                    payload.route = "/settings".to_string();
                    payload.section = Some("environments".to_string());
                }
                Some("tasks") if segments.get(1).copied() == Some("list") => {
                    payload.route = "/inbox".to_string();
                }
                Some("tasks") => {
                    payload.route = "/inbox".to_string();
                }
                Some("usage") => {
                    payload.route = "/settings".to_string();
                    payload.section = Some("usage-analytics".to_string());
                }
                Some("worktree_snapshots")
                    if matches!(
                        segments.get(1).copied(),
                        Some("finish_upload") | Some("upload_url")
                    ) =>
                {
                    payload.route = "/settings".to_string();
                    payload.section = Some("worktrees".to_string());
                }
                _ => return Err("unsupported wham deeplink target".to_string()),
            }
        }
        _ => return Err(format!("unsupported deeplink host: {host}")),
    }

    Ok(payload)
}

pub fn apply_update_transition(
    current: HostUpdateStatePayload,
    transition: HostUpdateTransition,
    now_ts: i64,
) -> HostUpdateStatePayload {
    match transition {
        HostUpdateTransition::StartCheck => HostUpdateStatePayload {
            status: HostUpdateStatus::Checking,
            detail: Some("Checking for updates…".to_string()),
            checked_at: current.checked_at,
        },
        HostUpdateTransition::MarkAvailable => HostUpdateStatePayload {
            status: HostUpdateStatus::Available,
            detail: Some("Update available.".to_string()),
            checked_at: Some(now_ts),
        },
        HostUpdateTransition::MarkUpToDate => HostUpdateStatePayload {
            status: HostUpdateStatus::UpToDate,
            detail: Some("App is up to date.".to_string()),
            checked_at: Some(now_ts),
        },
        HostUpdateTransition::MarkError => HostUpdateStatePayload {
            status: HostUpdateStatus::Error,
            detail: Some("Update check failed.".to_string()),
            checked_at: Some(now_ts),
        },
        HostUpdateTransition::Reset => HostUpdateStatePayload::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_update_transition, parse_codex_deeplink, HostUpdateStatePayload, HostUpdateStatus,
        HostUpdateTransition,
    };

    #[test]
    fn parses_settings_deeplink_with_path_section() {
        let payload = parse_codex_deeplink("codex://settings/general").expect("deeplink parsed");
        assert_eq!(payload.route, "/settings");
        assert_eq!(payload.section.as_deref(), Some("general"));
    }

    #[test]
    fn parses_remote_task_deeplink() {
        let payload = parse_codex_deeplink("codex://remote/task-123").expect("deeplink parsed");
        assert_eq!(payload.route, "/remote");
        assert_eq!(payload.task_id.as_deref(), Some("task-123"));
    }

    #[test]
    fn parses_local_thread_deeplink() {
        let payload = parse_codex_deeplink("codex://threads/local/thread-1").expect("parsed");
        assert_eq!(payload.route, "/t");
        assert_eq!(payload.thread_id.as_deref(), Some("thread-1"));
    }

    #[test]
    fn parses_welcome_alias_deeplink() {
        let payload = parse_codex_deeplink("codex://first-run").expect("parsed");
        assert_eq!(payload.route, "/welcome");
    }

    #[test]
    fn parses_thread_overlay_deeplink() {
        let payload = parse_codex_deeplink("codex://thread-overlay/thread-77").expect("parsed");
        assert_eq!(payload.route, "/thread-overlay");
        assert_eq!(payload.thread_id.as_deref(), Some("thread-77"));
    }

    #[test]
    fn parses_select_workspace_deeplink() {
        let payload = parse_codex_deeplink("codex://select-workspace").expect("parsed");
        assert_eq!(payload.route, "/select-workspace");
    }

    #[test]
    fn parses_wham_usage_deeplink() {
        let payload = parse_codex_deeplink("codex://wham/usage").expect("parsed");
        assert_eq!(payload.route, "/settings");
        assert_eq!(payload.section.as_deref(), Some("usage-analytics"));
    }

    #[test]
    fn rejects_non_codex_scheme() {
        let error = parse_codex_deeplink("https://example.com").expect_err("must fail");
        assert!(error.contains("scheme"));
    }

    #[test]
    fn update_state_transitions_are_stable() {
        let base = HostUpdateStatePayload::default();
        assert_eq!(base.status, HostUpdateStatus::Idle);

        let checking = apply_update_transition(base, HostUpdateTransition::StartCheck, 10);
        assert_eq!(checking.status, HostUpdateStatus::Checking);
        assert_eq!(checking.checked_at, None);

        let up_to_date = apply_update_transition(checking, HostUpdateTransition::MarkUpToDate, 30);
        assert_eq!(up_to_date.status, HostUpdateStatus::UpToDate);
        assert_eq!(up_to_date.checked_at, Some(30));

        let errored = apply_update_transition(up_to_date, HostUpdateTransition::MarkError, 40);
        assert_eq!(errored.status, HostUpdateStatus::Error);
        assert_eq!(errored.checked_at, Some(40));

        let reset = apply_update_transition(errored, HostUpdateTransition::Reset, 99);
        assert_eq!(reset.status, HostUpdateStatus::Idle);
        assert_eq!(reset.checked_at, None);
    }
}
