use crate::paths::codex_home_dir;
use chrono::{
    Datelike, Duration as ChronoDuration, LocalResult, NaiveDate, TimeZone, Utc, Weekday,
};
use chrono_tz::Tz;
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
                let rrule: String = row.get(7)?;
                Ok(AutomationRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    prompt: row.get(2)?,
                    status: row.get(3)?,
                    next_run_at: row.get(4)?,
                    last_run_at: row.get(5)?,
                    cwds,
                    rrule: normalize_rrule(&rrule),
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
        let normalized_rrule = normalize_rrule(&params.rrule);
        let next_run_at = if status.eq_ignore_ascii_case("ACTIVE") {
            params
                .next_run_at
                .or_else(|| compute_next_run_at(&normalized_rrule, now))
        } else {
            None
        };
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
                    next_run_at,
                    params.last_run_at,
                    cwds_json,
                    normalized_rrule,
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
        let now = now_ts();
        let current = self
            .get_automation(params.id.clone())
            .await?
            .ok_or_else(|| "automation not found".to_string())?;
        let status = params.status.unwrap_or(current.status.clone());
        let raw_rrule = params.rrule.unwrap_or(current.rrule.clone());
        let rrule = normalize_rrule(&raw_rrule);
        let mut next_run_at = params.next_run_at.or(current.next_run_at);
        if status.eq_ignore_ascii_case("ACTIVE") {
            if next_run_at.is_none() || rrule != current.rrule {
                next_run_at = compute_next_run_at(&rrule, now);
            }
        } else {
            next_run_at = None;
        }
        let updated = AutomationRecord {
            id: current.id.clone(),
            name: params.name.unwrap_or(current.name),
            prompt: params.prompt.unwrap_or(current.prompt),
            status,
            next_run_at,
            last_run_at: params.last_run_at.or(current.last_run_at),
            cwds: params.cwds.unwrap_or(current.cwds),
            rrule,
            created_at: current.created_at,
            updated_at: now,
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
            let thread_id: Option<String> = connection
                .query_row(
                    "SELECT thread_id FROM inbox_items WHERE id = ?1",
                    params![&id],
                    |row| row.get(0),
                )
                .optional()?;
            connection.execute(
                "UPDATE inbox_items SET read_at = ?2 WHERE id = ?1",
                params![id, now],
            )?;
            if let Some(thread_id) = thread_id {
                connection.execute(
                    "UPDATE automation_runs SET read_at = COALESCE(read_at, ?2), updated_at = ?2 WHERE thread_id = ?1",
                    params![thread_id, now],
                )?;
            }
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
                let rrule: String = row.get(7)?;
                Ok(AutomationRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    prompt: row.get(2)?,
                    status: row.get(3)?,
                    next_run_at: row.get(4)?,
                    last_run_at: row.get(5)?,
                    cwds,
                    rrule: normalize_rrule(&rrule),
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
        inbox_title: Option<String>,
        inbox_summary: Option<String>,
    ) -> Result<(), String> {
        let now = now_ts();
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automation_runs
                SET status = ?2,
                    thread_title = COALESCE(?3, thread_title),
                    inbox_title = COALESCE(?4, inbox_title),
                    inbox_summary = COALESCE(?5, inbox_summary),
                    updated_at = ?6
                WHERE id = ?1
                "#,
                params![
                    run_id,
                    status,
                    thread_title,
                    inbox_title,
                    inbox_summary,
                    now
                ],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn create_inbox_item_for_run(&self, run: &AutomationRunRecord) -> Result<(), String> {
        let now = now_ts();
        let title = run
            .inbox_title
            .clone()
            .unwrap_or_else(|| "Automation run".to_string());
        let description = run
            .inbox_summary
            .clone()
            .unwrap_or_else(|| "New automation output is ready for review.".to_string());
        self.with_connection(|connection| {
            let existing: Option<String> = connection
                .query_row(
                    "SELECT id FROM inbox_items WHERE thread_id = ?1 LIMIT 1",
                    params![run.thread_id],
                    |row| row.get(0),
                )
                .optional()?;
            if existing.is_some() {
                return Ok(());
            }
            let id = format!("inbox-{}", Uuid::new_v4());
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
        let normalized_rrule = normalize_rrule(&rrule);
        let next_run = compute_next_run_at(&normalized_rrule, run_at);
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automations
                SET last_run_at = ?2, next_run_at = ?3, rrule = ?4, updated_at = ?2
                WHERE id = ?1
                "#,
                params![automation_id, run_at, next_run, normalized_rrule],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn set_automation_next_run_at(
        &self,
        automation_id: String,
        next_run_at: Option<i64>,
    ) -> Result<(), String> {
        let now = now_ts();
        self.with_connection(|connection| {
            connection.execute(
                r#"
                UPDATE automations
                SET next_run_at = ?2, updated_at = ?3
                WHERE id = ?1
                "#,
                params![automation_id, next_run_at, now],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn automation_by_id(&self, id: String) -> Result<Option<AutomationRecord>, String> {
        self.get_automation(id).await
    }

    pub async fn run_by_id(&self, id: String) -> Result<Option<AutomationRunRecord>, String> {
        self.get_run(id).await
    }

    pub async fn run_by_thread_id(
        &self,
        thread_id: String,
    ) -> Result<Option<AutomationRunRecord>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT id, thread_id, automation_id, status, read_at, thread_title, source_cwd, inbox_title, inbox_summary, created_at, updated_at, archived_user_message, archived_assistant_message, archived_reason
                FROM automation_runs
                WHERE thread_id = ?1
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )?;
            statement
                .query_row(params![thread_id], map_run_row)
                .optional()
        })
        .await
    }

    pub async fn delete_run_by_thread_id(&self, thread_id: String) -> Result<bool, String> {
        self.with_connection(|connection| {
            let run_id: Option<String> = connection
                .query_row(
                    "SELECT id FROM automation_runs WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT 1",
                    params![&thread_id],
                    |row| row.get(0),
                )
                .optional()?;
            let Some(run_id) = run_id else {
                return Ok(false);
            };
            connection.execute(
                "DELETE FROM inbox_items WHERE thread_id = ?1",
                params![&thread_id],
            )?;
            connection.execute(
                "DELETE FROM automation_runs WHERE id = ?1",
                params![run_id],
            )?;
            Ok(true)
        })
        .await
    }

    pub async fn next_due_timestamp(&self) -> Result<Option<i64>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                r#"
                SELECT MIN(next_run_at)
                FROM automations
                WHERE status = 'ACTIVE'
                AND next_run_at IS NOT NULL
                "#,
            )?;
            statement.query_row([], |row| row.get(0)).optional()
        })
        .await
        .map(|value| value.flatten())
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
                    let rrule: String = row.get(7)?;
                    Ok(AutomationRecord {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        prompt: row.get(2)?,
                        status: row.get(3)?,
                        next_run_at: row.get(4)?,
                        last_run_at: row.get(5)?,
                        cwds,
                        rrule: normalize_rrule(&rrule),
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

fn parse_rrule_i64(rrule: &str, key: &str) -> Option<i64> {
    parse_rrule_value(rrule, key).and_then(|value| value.parse::<i64>().ok())
}

fn parse_rrule_u32(rrule: &str, key: &str, fallback: u32, max: u32) -> u32 {
    parse_rrule_value(rrule, key)
        .and_then(|value| value.parse::<u32>().ok())
        .map(|value| value.min(max))
        .unwrap_or(fallback)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let first_next =
        NaiveDate::from_ymd_opt(next_year, next_month, 1).expect("valid first day of next month");
    let last_current = first_next - ChronoDuration::days(1);
    last_current.day()
}

fn canonical_timezone(rrule: &str) -> String {
    parse_rrule_value(rrule, "TZID")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("UTC")
        .to_string()
}

fn parse_timezone(rrule: &str) -> Tz {
    canonical_timezone(rrule)
        .parse::<Tz>()
        .unwrap_or(chrono_tz::UTC)
}

fn local_datetime(
    timezone: Tz,
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
) -> Option<chrono::DateTime<Tz>> {
    let naive = NaiveDate::from_ymd_opt(year, month, day)?.and_hms_opt(hour, minute, 0)?;
    match timezone.from_local_datetime(&naive) {
        LocalResult::Single(datetime) => Some(datetime),
        LocalResult::Ambiguous(datetime, _) => Some(datetime),
        LocalResult::None => None,
    }
}

pub fn normalize_rrule(rrule: &str) -> String {
    let freq = parse_rrule_value(rrule, "FREQ")
        .unwrap_or("DAILY")
        .to_uppercase();
    let hour = parse_rrule_u32(rrule, "BYHOUR", 9, 23);
    let minute = parse_rrule_u32(rrule, "BYMINUTE", 0, 59);
    let tzid = canonical_timezone(rrule);

    if freq == "DAILY" {
        return format!("FREQ=DAILY;BYHOUR={hour};BYMINUTE={minute};TZID={tzid}");
    }
    if freq == "WEEKLY" {
        let byday = parse_rrule_value(rrule, "BYDAY")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("MO");
        return format!("FREQ=WEEKLY;BYDAY={byday};BYHOUR={hour};BYMINUTE={minute};TZID={tzid}");
    }
    if freq == "MONTHLY" {
        let bymonthday = parse_rrule_u32(rrule, "BYMONTHDAY", 1, 31).max(1);
        return format!(
            "FREQ=MONTHLY;BYMONTHDAY={bymonthday};BYHOUR={hour};BYMINUTE={minute};TZID={tzid}"
        );
    }
    if freq == "HOURLY" && parse_rrule_i64(rrule, "INTERVAL").unwrap_or(1) == 720 {
        let bymonthday = parse_rrule_u32(rrule, "BYMONTHDAY", 1, 31).max(1);
        return format!(
            "FREQ=MONTHLY;BYMONTHDAY={bymonthday};BYHOUR={hour};BYMINUTE={minute};TZID={tzid}"
        );
    }
    rrule.to_string()
}

fn weekday_from_token(value: &str) -> Option<Weekday> {
    match value {
        "SU" => Some(Weekday::Sun),
        "MO" => Some(Weekday::Mon),
        "TU" => Some(Weekday::Tue),
        "WE" => Some(Weekday::Wed),
        "TH" => Some(Weekday::Thu),
        "FR" => Some(Weekday::Fri),
        "SA" => Some(Weekday::Sat),
        _ => None,
    }
}

pub fn compute_next_run_at(rrule: &str, from_ts: i64) -> Option<i64> {
    let normalized = normalize_rrule(rrule);
    let freq = parse_rrule_value(&normalized, "FREQ")
        .unwrap_or("DAILY")
        .to_uppercase();

    if freq == "HOURLY" {
        let interval = parse_rrule_value(rrule, "INTERVAL")
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        return Some(from_ts + interval * 3600);
    }

    if freq == "WEEKLY" {
        let timezone = parse_timezone(&normalized);
        let byday = parse_rrule_value(&normalized, "BYDAY").unwrap_or("MO");
        let byhour = parse_rrule_u32(&normalized, "BYHOUR", 9, 23);
        let byminute = parse_rrule_u32(&normalized, "BYMINUTE", 0, 59);
        let mut candidate_days = byday
            .split(',')
            .filter_map(weekday_from_token)
            .collect::<Vec<Weekday>>();
        if candidate_days.is_empty() {
            candidate_days.push(Weekday::Mon);
        }
        let base_utc = Utc.timestamp_opt(from_ts, 0).single()?;
        let base_local = base_utc.with_timezone(&timezone);
        for offset in 0..14 {
            let candidate_date = base_local.date_naive() + ChronoDuration::days(offset);
            if !candidate_days.contains(&candidate_date.weekday()) {
                continue;
            }
            let Some(candidate) = local_datetime(
                timezone,
                candidate_date.year(),
                candidate_date.month(),
                candidate_date.day(),
                byhour,
                byminute,
            ) else {
                continue;
            };
            if candidate.timestamp() > from_ts {
                return Some(candidate.timestamp());
            }
        }
        return Some(from_ts + 7 * 24 * 3600);
    }

    if freq == "DAILY" {
        let timezone = parse_timezone(&normalized);
        let byhour = parse_rrule_u32(&normalized, "BYHOUR", 9, 23);
        let byminute = parse_rrule_u32(&normalized, "BYMINUTE", 0, 59);
        let base_utc = Utc.timestamp_opt(from_ts, 0).single()?;
        let base_local = base_utc.with_timezone(&timezone);
        let candidate = local_datetime(
            timezone,
            base_local.year(),
            base_local.month(),
            base_local.day(),
            byhour,
            byminute,
        )?;
        if candidate.timestamp() > from_ts {
            return Some(candidate.timestamp());
        }
        let next_date = base_local.date_naive() + ChronoDuration::days(1);
        let next = local_datetime(
            timezone,
            next_date.year(),
            next_date.month(),
            next_date.day(),
            byhour,
            byminute,
        )?;
        return Some(next.timestamp());
    }

    if freq == "MONTHLY" {
        let timezone = parse_timezone(&normalized);
        let byhour = parse_rrule_u32(&normalized, "BYHOUR", 9, 23);
        let byminute = parse_rrule_u32(&normalized, "BYMINUTE", 0, 59);
        let target_day = parse_rrule_u32(&normalized, "BYMONTHDAY", 1, 31).max(1);
        let base_utc = Utc.timestamp_opt(from_ts, 0).single()?;
        let base_local = base_utc.with_timezone(&timezone);
        let mut year = base_local.year();
        let mut month = base_local.month();
        for _ in 0..24 {
            let day = target_day.min(days_in_month(year, month));
            let Some(candidate) = local_datetime(timezone, year, month, day, byhour, byminute)
            else {
                if month == 12 {
                    month = 1;
                    year += 1;
                } else {
                    month += 1;
                }
                continue;
            };
            if candidate.timestamp() > from_ts {
                return Some(candidate.timestamp());
            }
            if month == 12 {
                month = 1;
                year += 1;
            } else {
                month += 1;
            }
        }
    }

    Some(from_ts + 24 * 3600)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn with_temp_codex_home<T>(name: &str, test: impl FnOnce() -> T) -> T {
        let _guard = env_lock().lock().expect("failed to lock test env");
        let previous = std::env::var_os("CODEX_HOME");
        let temp_home =
            std::env::temp_dir().join(format!("codex-desktop-{name}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_home).expect("failed to create temp CODEX_HOME");
        std::env::set_var("CODEX_HOME", &temp_home);
        let result = test();
        match previous {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
        let _ = std::fs::remove_dir_all(&temp_home);
        result
    }

    fn read_automation_toml(home: &OsString, automation_id: &str) -> String {
        std::fs::read_to_string(
            PathBuf::from(home)
                .join("automations")
                .join(automation_id)
                .join("automation.toml"),
        )
        .expect("failed to read automation TOML")
    }

    #[test]
    fn computes_next_run_for_daily_weekly_monthly_and_legacy_rules() {
        let hourly = compute_next_run_at("FREQ=HOURLY;INTERVAL=6", 1_000_000);
        assert_eq!(hourly, Some(1_021_600));

        let weekly = compute_next_run_at("FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0", 1_704_069_600);
        assert_eq!(weekly, Some(1_704_099_600));

        let daily = compute_next_run_at("FREQ=DAILY;BYHOUR=9;BYMINUTE=0;TZID=UTC", 1_704_067_200);
        assert_eq!(daily, Some(1_704_099_600));

        let monthly = compute_next_run_at(
            "FREQ=MONTHLY;BYMONTHDAY=31;BYHOUR=8;BYMINUTE=0;TZID=UTC",
            1_706_700_000,
        );
        assert!(monthly.expect("missing monthly schedule") > 1_706_700_000);

        let legacy_monthly = normalize_rrule("FREQ=HOURLY;INTERVAL=720");
        assert_eq!(
            legacy_monthly,
            "FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0;TZID=UTC"
        );

        let daily_pacific = compute_next_run_at(
            "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;TZID=America/Los_Angeles",
            1_768_437_000,
        );
        assert_eq!(daily_pacific, Some(1_768_496_400));
    }

    #[test]
    fn persists_automation_records_runs_and_inbox_rows() {
        with_temp_codex_home("automation-store", || {
            let codex_home = std::env::var_os("CODEX_HOME").expect("CODEX_HOME missing");
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("failed to create runtime");
            runtime.block_on(async {
                let store = AutomationStore::new().expect("failed to create store");
                let created = store
                    .create_automation(AutomationCreateParams {
                        name: "Daily checks".to_string(),
                        prompt: "Run tests and summarize failures.".to_string(),
                        status: Some("ACTIVE".to_string()),
                        next_run_at: Some(1_800_000_000),
                        last_run_at: None,
                        cwds: vec!["/repo/theoden".to_string()],
                        rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0".to_string(),
                    })
                    .await
                    .expect("failed to create automation");
                assert_eq!(created.status, "ACTIVE");

                let listed = store
                    .list_automations()
                    .await
                    .expect("failed to list automations");
                assert_eq!(listed.len(), 1);
                assert_eq!(listed[0].id, created.id);

                let due = store
                    .due_automations(1_800_000_010)
                    .await
                    .expect("failed to list due automations");
                assert_eq!(due.len(), 1);
                assert_eq!(due[0].id, created.id);

                let automation_toml = read_automation_toml(&codex_home, &created.id);
                assert!(automation_toml.contains("name = \"Daily checks\""));
                assert!(automation_toml.contains("status = \"ACTIVE\""));

                let run = store
                    .create_run(
                        &created,
                        "thread-123".to_string(),
                        "IN_PROGRESS".to_string(),
                    )
                    .await
                    .expect("failed to create run");
                assert_eq!(run.automation_id, created.id);

                store
                    .update_run_status(
                        run.id.clone(),
                        "DONE".to_string(),
                        Some("Archived thread".to_string()),
                        None,
                        None,
                    )
                    .await
                    .expect("failed to update run status");
                let run_after_update = store
                    .run_by_id(run.id.clone())
                    .await
                    .expect("failed to load run")
                    .expect("run missing");
                assert_eq!(run_after_update.status, "DONE");
                assert_eq!(
                    run_after_update.thread_title.as_deref(),
                    Some("Archived thread")
                );

                store
                    .create_inbox_item_for_run(&run_after_update)
                    .await
                    .expect("failed to create inbox item");
                let inbox_items = store
                    .list_inbox_items()
                    .await
                    .expect("failed to list inbox items");
                assert_eq!(inbox_items.len(), 1);
                assert_eq!(inbox_items[0].thread_id, "thread-123");
                store
                    .create_inbox_item_for_run(&run_after_update)
                    .await
                    .expect("failed to create idempotent inbox item");
                let inbox_after_duplicate = store
                    .list_inbox_items()
                    .await
                    .expect("failed to list inbox items after duplicate create");
                assert_eq!(inbox_after_duplicate.len(), 1);

                store
                    .mark_inbox_read(inbox_items[0].id.clone())
                    .await
                    .expect("failed to mark inbox item read");
                let inbox_after_read = store
                    .list_inbox_items()
                    .await
                    .expect("failed to reload inbox items");
                assert!(inbox_after_read[0].read_at.is_some());
                let run_after_read = store
                    .run_by_id(run.id.clone())
                    .await
                    .expect("failed to read run after inbox read")
                    .expect("run missing after inbox read");
                assert!(run_after_read.read_at.is_some());

                store
                    .touch_automation_run_times(
                        created.id.clone(),
                        1_810_000_000,
                        created.rrule.clone(),
                    )
                    .await
                    .expect("failed to update run times");
                let updated = store
                    .automation_by_id(created.id.clone())
                    .await
                    .expect("failed to read updated automation")
                    .expect("updated automation missing");
                assert_eq!(updated.last_run_at, Some(1_810_000_000));
                assert!(updated.next_run_at.expect("missing next run") > 1_810_000_000);
            });
        });
    }
}
