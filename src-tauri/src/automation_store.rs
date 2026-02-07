use crate::paths::codex_home_dir;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRecord {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub status: String,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub cwds: Vec<String>,
    pub rrule: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunRecord {
    pub id: String,
    pub thread_id: String,
    pub automation_id: String,
    pub status: String,
    pub read_at: Option<i64>,
    pub thread_title: Option<String>,
    pub source_cwd: Option<String>,
    pub inbox_title: Option<String>,
    pub inbox_summary: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived_user_message: Option<String>,
    pub archived_assistant_message: Option<String>,
    pub archived_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxItemRecord {
    pub id: String,
    pub title: String,
    pub description: String,
    pub thread_id: String,
    pub read_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationCreateParams {
    pub name: String,
    pub prompt: String,
    pub status: Option<String>,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub cwds: Vec<String>,
    pub rrule: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationUpdateParams {
    pub id: String,
    pub name: Option<String>,
    pub prompt: Option<String>,
    pub status: Option<String>,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub cwds: Option<Vec<String>>,
    pub rrule: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNowParams {
    pub automation_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunArchiveParams {
    pub run_id: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct AutomationToml {
    name: String,
    prompt: String,
    status: String,
    cwds: Vec<String>,
    rrule: String,
}

pub struct AutomationStore {
    db_path: PathBuf,
    automations_dir: PathBuf,
    lock: Mutex<()>,
}

impl AutomationStore {
    pub fn new() -> Result<Self, String> {
        let codex_home = codex_home_dir()?;
        let sqlite_dir = codex_home.join("sqlite");
        std::fs::create_dir_all(&sqlite_dir)
            .map_err(|err| format!("failed to create sqlite directory: {err}"))?;
        let automations_dir = codex_home.join("automations");
        std::fs::create_dir_all(&automations_dir)
            .map_err(|err| format!("failed to create automations directory: {err}"))?;
        let db_path = sqlite_dir.join("codex-dev.db");
        let this = Self {
            db_path,
            automations_dir,
            lock: Mutex::new(()),
        };
        this.init_schema()?;
        Ok(this)
    }

    fn init_schema(&self) -> Result<(), String> {
        let connection = Connection::open(&self.db_path)
            .map_err(|err| format!("failed to open automation database: {err}"))?;
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS automations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    status TEXT NOT NULL,
                    next_run_at INTEGER,
                    last_run_at INTEGER,
                    cwds TEXT NOT NULL,
                    rrule TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS automation_runs (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    automation_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    read_at INTEGER,
                    thread_title TEXT,
                    source_cwd TEXT,
                    inbox_title TEXT,
                    inbox_summary TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    archived_user_message TEXT,
                    archived_assistant_message TEXT,
                    archived_reason TEXT
                );

                CREATE TABLE IF NOT EXISTS inbox_items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    read_at INTEGER,
                    created_at INTEGER NOT NULL
                );
                "#,
            )
            .map_err(|err| format!("failed to initialize automation schema: {err}"))?;
        Ok(())
    }

    pub async fn list_automations(&self) -> Result<Vec<AutomationRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, name, prompt, status, next_run_at, last_run_at, cwds, rrule, created_at, updated_at
                FROM automations
                ORDER BY created_at DESC
                "#,
            )?;
            let rows = statement.query_map([], |row| {
                let cwds_json: String = row.get(6)?;
                let cwds = serde_json::from_str::<Vec<String>>(&cwds_json).unwrap_or_default();
                Ok(AutomationRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    prompt: row.get(2)?,
                    status: row.get(3)?,
                    next_run_at: row.get(4)?,
                    last_run_at: row.get(5)?,
                    cwds,
                    rrule: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?;
            let mut output = Vec::new();
            for row in rows {
                output.push(row?);
            }
            Ok(output)
        })
        .await
    }

    pub async fn create_automation(
        &self,
        params: AutomationCreateParams,
    ) -> Result<AutomationRecord, String> {
        let now = now_ts();
        let status = params.status.unwrap_or_else(|| "ACTIVE".to_string());
        let cwds_json = serde_json::to_string(&params.cwds)
            .map_err(|err| format!("failed to serialize automation cwds: {err}"))?;
        let id = format!("automation-{}", Uuid::new_v4());
        self.with_connection(|connection| {
            connection.execute(
                r#"
                INSERT INTO automations (id, name, prompt, status, next_run_at, last_run_at, cwds, rrule, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    id,
                    params.name,
                    params.prompt,
                    status,
                    params.next_run_at,
                    params.last_run_at,
                    cwds_json,
                    params.rrule,
                    now,
                    now
                ],
            )?;
            Ok(())
        })
        .await?;

        let created = self
            .get_automation(id.clone())
            .await?
            .ok_or_else(|| "created automation could not be read".to_string())?;
        self.write_automation_toml(&created)?;
        Ok(created)
    }

    pub async fn update_automation(
        &self,
        params: AutomationUpdateParams,
    ) -> Result<AutomationRecord, String> {
        let current = self
            .get_automation(params.id.clone())
            .await?
            .ok_or_else(|| "automation not found".to_string())?;
        let updated = AutomationRecord {
            id: current.id.clone(),
            name: params.name.unwrap_or(current.name),
            prompt: params.prompt.unwrap_or(current.prompt),
            status: params.status.unwrap_or(current.status),
            next_run_at: params.next_run_at.or(current.next_run_at),
            last_run_at: params.last_run_at.or(current.last_run_at),
            cwds: params.cwds.unwrap_or(current.cwds),
            rrule: params.rrule.unwrap_or(current.rrule),
            created_at: current.created_at,
            updated_at: now_ts(),
        };
        let cwds_json = serde_json::to_string(&updated.cwds)
            .map_err(|err| format!("failed to serialize automation cwds: {err}"))?;
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automations
                SET name = ?2, prompt = ?3, status = ?4, next_run_at = ?5, last_run_at = ?6, cwds = ?7, rrule = ?8, updated_at = ?9
                WHERE id = ?1
                "#,
                params![
                    updated.id,
                    updated.name,
                    updated.prompt,
                    updated.status,
                    updated.next_run_at,
                    updated.last_run_at,
                    cwds_json,
                    updated.rrule,
                    updated.updated_at
                ],
            )?;
            Ok(())
        })
        .await?;
        self.write_automation_toml(&updated)?;
        Ok(updated)
    }

    pub async fn delete_automation(&self, id: String) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute("DELETE FROM automations WHERE id = ?1", params![id])?;
            Ok(())
        })
        .await?;
        let automation_dir = self.automations_dir.join(&id);
        if automation_dir.exists() {
            let _ = std::fs::remove_dir_all(&automation_dir);
        }
        Ok(())
    }

    pub async fn list_runs(
        &self,
        automation_id: Option<String>,
    ) -> Result<Vec<AutomationRunRecord>, String> {
        self.with_connection(|connection| {
            let sql = if automation_id.is_some() {
                r#"
                SELECT id, thread_id, automation_id, status, read_at, thread_title, source_cwd, inbox_title, inbox_summary, created_at, updated_at, archived_user_message, archived_assistant_message, archived_reason
                FROM automation_runs
                WHERE automation_id = ?1
                ORDER BY created_at DESC
                "#
            } else {
                r#"
                SELECT id, thread_id, automation_id, status, read_at, thread_title, source_cwd, inbox_title, inbox_summary, created_at, updated_at, archived_user_message, archived_assistant_message, archived_reason
                FROM automation_runs
                ORDER BY created_at DESC
                "#
            };
            let mut statement = connection.prepare(sql)?;
            let mut output = Vec::new();
            if let Some(automation_id) = automation_id {
                let rows = statement.query_map(params![automation_id], map_run_row)?;
                for row in rows {
                    output.push(row?);
                }
            } else {
                let rows = statement.query_map([], map_run_row)?;
                for row in rows {
                    output.push(row?);
                }
            }
            Ok(output)
        })
        .await
    }

    pub async fn archive_run(&self, params: RunArchiveParams) -> Result<(), String> {
        let now = now_ts();
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automation_runs
                SET status = 'ARCHIVED', archived_reason = ?2, read_at = COALESCE(read_at, ?3), updated_at = ?3
                WHERE id = ?1
                "#,
                params![params.run_id, params.reason, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn list_inbox_items(&self) -> Result<Vec<InboxItemRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, title, description, thread_id, read_at, created_at
                FROM inbox_items
                ORDER BY created_at DESC
                "#,
            )?;
            let rows = statement.query_map([], |row| {
                Ok(InboxItemRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    thread_id: row.get(3)?,
                    read_at: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?;
            let mut output = Vec::new();
            for row in rows {
                output.push(row?);
            }
            Ok(output)
        })
        .await
    }

    pub async fn mark_inbox_read(&self, id: String) -> Result<(), String> {
        let now = now_ts();
        self.with_connection(|connection| {
            connection.execute(
                "UPDATE inbox_items SET read_at = ?2 WHERE id = ?1",
                params![id, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn due_automations(&self, now: i64) -> Result<Vec<AutomationRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, name, prompt, status, next_run_at, last_run_at, cwds, rrule, created_at, updated_at
                FROM automations
                WHERE status = 'ACTIVE'
                AND next_run_at IS NOT NULL
                AND next_run_at <= ?1
                ORDER BY next_run_at ASC
                "#,
            )?;
            let rows = statement.query_map(params![now], |row| {
                let cwds_json: String = row.get(6)?;
                let cwds = serde_json::from_str::<Vec<String>>(&cwds_json).unwrap_or_default();
                Ok(AutomationRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    prompt: row.get(2)?,
                    status: row.get(3)?,
                    next_run_at: row.get(4)?,
                    last_run_at: row.get(5)?,
                    cwds,
                    rrule: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?;
            let mut output = Vec::new();
            for row in rows {
                output.push(row?);
            }
            Ok(output)
        })
        .await
    }

    pub async fn create_run(
        &self,
        automation: &AutomationRecord,
        thread_id: String,
        status: String,
    ) -> Result<AutomationRunRecord, String> {
        let now = now_ts();
        let id = format!("run-{}", Uuid::new_v4());
        let source_cwd = automation.cwds.first().cloned();
        let inbox_title = format!("Automation: {}", automation.name);
        let inbox_summary = "Automation run completed and ready for review.".to_string();
        self.with_connection(|connection| {
            connection.execute(
                r#"
                INSERT INTO automation_runs (id, thread_id, automation_id, status, read_at, thread_title, source_cwd, inbox_title, inbox_summary, created_at, updated_at, archived_user_message, archived_assistant_message, archived_reason)
                VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, ?6, ?7, ?8, ?8, NULL, NULL, NULL)
                "#,
                params![
                    id,
                    thread_id,
                    automation.id,
                    status,
                    source_cwd,
                    inbox_title,
                    inbox_summary,
                    now
                ],
            )?;
            Ok(())
        })
        .await?;
        self.get_run(id)
            .await?
            .ok_or_else(|| "created run could not be read".to_string())
    }

    pub async fn update_run_status(
        &self,
        run_id: String,
        status: String,
        thread_title: Option<String>,
    ) -> Result<(), String> {
        let now = now_ts();
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automation_runs
                SET status = ?2, thread_title = COALESCE(?3, thread_title), updated_at = ?4
                WHERE id = ?1
                "#,
                params![run_id, status, thread_title, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn create_inbox_item_for_run(&self, run: &AutomationRunRecord) -> Result<(), String> {
        let now = now_ts();
        let id = format!("inbox-{}", Uuid::new_v4());
        let title = run
            .inbox_title
            .clone()
            .unwrap_or_else(|| "Automation run".to_string());
        let description = run
            .inbox_summary
            .clone()
            .unwrap_or_else(|| "New automation output is ready for review.".to_string());
        self.with_connection(|connection| {
            connection.execute(
                r#"
                INSERT INTO inbox_items (id, title, description, thread_id, read_at, created_at)
                VALUES (?1, ?2, ?3, ?4, NULL, ?5)
                "#,
                params![id, title, description, run.thread_id, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn touch_automation_run_times(
        &self,
        automation_id: String,
        run_at: i64,
        rrule: String,
    ) -> Result<(), String> {
        let next_run = compute_next_run_at(&rrule, run_at);
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automations
                SET last_run_at = ?2, next_run_at = ?3, updated_at = ?2
                WHERE id = ?1
                "#,
                params![automation_id, run_at, next_run],
            )?;
            Ok(())
        })
        .await
    }

    async fn get_automation(&self, id: String) -> Result<Option<AutomationRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, name, prompt, status, next_run_at, last_run_at, cwds, rrule, created_at, updated_at
                FROM automations
                WHERE id = ?1
                "#,
            )?;
            statement
                .query_row(params![id], |row| {
                    let cwds_json: String = row.get(6)?;
                    let cwds = serde_json::from_str::<Vec<String>>(&cwds_json).unwrap_or_default();
                    Ok(AutomationRecord {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        prompt: row.get(2)?,
                        status: row.get(3)?,
                        next_run_at: row.get(4)?,
                        last_run_at: row.get(5)?,
                        cwds,
                        rrule: row.get(7)?,
                        created_at: row.get(8)?,
                        updated_at: row.get(9)?,
                    })
                })
                .optional()
        })
        .await
    }

    async fn get_run(&self, id: String) -> Result<Option<AutomationRunRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, thread_id, automation_id, status, read_at, thread_title, source_cwd, inbox_title, inbox_summary, created_at, updated_at, archived_user_message, archived_assistant_message, archived_reason
                FROM automation_runs
                WHERE id = ?1
                "#,
            )?;
            statement.query_row(params![id], map_run_row).optional()
        })
        .await
    }

    fn write_automation_toml(&self, automation: &AutomationRecord) -> Result<(), String> {
        let automation_dir = self.automations_dir.join(&automation.id);
        std::fs::create_dir_all(&automation_dir)
            .map_err(|err| format!("failed to create automation directory: {err}"))?;
        let payload = AutomationToml {
            name: automation.name.clone(),
            prompt: automation.prompt.clone(),
            status: automation.status.clone(),
            cwds: automation.cwds.clone(),
            rrule: automation.rrule.clone(),
        };
        let toml_text = toml::to_string_pretty(&payload)
            .map_err(|err| format!("failed to serialize automation TOML: {err}"))?;
        std::fs::write(automation_dir.join("automation.toml"), toml_text)
            .map_err(|err| format!("failed to write automation TOML: {err}"))?;
        Ok(())
    }

    async fn with_connection<T, F>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> rusqlite::Result<T>,
    {
        let _guard = self.lock.lock().await;
        let connection = Connection::open(&self.db_path)
            .map_err(|err| format!("failed to open automation database: {err}"))?;
        f(&connection).map_err(|err| format!("automation database operation failed: {err}"))
    }
}

fn map_run_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AutomationRunRecord> {
    Ok(AutomationRunRecord {
        id: row.get(0)?,
        thread_id: row.get(1)?,
        automation_id: row.get(2)?,
        status: row.get(3)?,
        read_at: row.get(4)?,
        thread_title: row.get(5)?,
        source_cwd: row.get(6)?,
        inbox_title: row.get(7)?,
        inbox_summary: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        archived_user_message: row.get(11)?,
        archived_assistant_message: row.get(12)?,
        archived_reason: row.get(13)?,
    })
}

pub fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn parse_rrule_value<'a>(rrule: &'a str, key: &str) -> Option<&'a str> {
    rrule
        .split(';')
        .find_map(|part| part.strip_prefix(&format!("{key}=")))
}

fn weekday_index(value: &str) -> Option<i64> {
    match value {
        "SU" => Some(0),
        "MO" => Some(1),
        "TU" => Some(2),
        "WE" => Some(3),
        "TH" => Some(4),
        "FR" => Some(5),
        "SA" => Some(6),
        _ => None,
    }
}

pub fn compute_next_run_at(rrule: &str, from_ts: i64) -> Option<i64> {
    if rrule.contains("FREQ=HOURLY") {
        let interval = parse_rrule_value(rrule, "INTERVAL")
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        return Some(from_ts + interval * 3600);
    }

    if rrule.contains("FREQ=WEEKLY") {
        let byday = parse_rrule_value(rrule, "BYDAY").unwrap_or("MO");
        let byhour = parse_rrule_value(rrule, "BYHOUR")
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(9);
        let byminute = parse_rrule_value(rrule, "BYMINUTE")
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(0);
        let current_day = ((from_ts / 86400 + 4) % 7 + 7) % 7;
        let mut candidate_days = byday
            .split(',')
            .filter_map(weekday_index)
            .collect::<Vec<i64>>();
        if candidate_days.is_empty() {
            candidate_days.push(1);
        }
        candidate_days.sort_unstable();
        let seconds_today = from_ts.rem_euclid(86400);
        let time_of_day = byhour * 3600 + byminute * 60;
        for day in &candidate_days {
            let delta_days = (day - current_day + 7) % 7;
            let next = from_ts - seconds_today + delta_days * 86400 + time_of_day;
            if next > from_ts {
                return Some(next);
            }
        }
        let first_day = candidate_days[0];
        let delta_days = (first_day - current_day + 7) % 7 + 7;
        return Some(from_ts - seconds_today + delta_days * 86400 + time_of_day);
    }

    Some(from_ts + 24 * 3600)
}
