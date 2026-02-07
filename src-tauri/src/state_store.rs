use crate::paths::codex_home_dir;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::Mutex;

pub struct StateStore {
    file_path: PathBuf,
    atoms: Mutex<HashMap<String, Value>>,
}

impl StateStore {
    pub fn new() -> Result<Self, String> {
        let codex_home = codex_home_dir()?;
        let state_dir = codex_home.join("desktop");
        std::fs::create_dir_all(&state_dir)
            .map_err(|err| format!("failed to create desktop state directory: {err}"))?;
        let file_path = state_dir.join("persisted-atoms.json");
        let atoms = if file_path.exists() {
            let raw = std::fs::read_to_string(&file_path)
                .map_err(|err| format!("failed to read persisted atoms file: {err}"))?;
            match serde_json::from_str::<HashMap<String, Value>>(&raw) {
                Ok(value) => value,
                Err(_) => HashMap::new(),
            }
        } else {
            HashMap::new()
        };

        Ok(Self {
            file_path,
            atoms: Mutex::new(atoms),
        })
    }

    pub async fn sync(&self, key: String) -> Result<Value, String> {
        let atoms = self.atoms.lock().await;
        Ok(atoms.get(&key).cloned().unwrap_or(Value::Null))
    }

    pub async fn update(&self, key: String, value: Value) -> Result<(), String> {
        let mut atoms = self.atoms.lock().await;
        atoms.insert(key, value);
        let snapshot = atoms.clone();
        drop(atoms);
        self.persist(snapshot).await
    }

    pub async fn reset(&self, key: String) -> Result<(), String> {
        let mut atoms = self.atoms.lock().await;
        atoms.remove(&key);
        let snapshot = atoms.clone();
        drop(atoms);
        self.persist(snapshot).await
    }

    async fn persist(&self, atoms: HashMap<String, Value>) -> Result<(), String> {
        let file_path = self.file_path.clone();
        tokio::task::spawn_blocking(move || {
            let encoded = serde_json::to_string_pretty(&atoms)
                .map_err(|err| format!("failed to serialize persisted atoms: {err}"))?;
            let temp_name = format!(
                "{}.tmp-{}",
                file_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("persisted-atoms.json"),
                std::process::id()
            );
            let temp_path = file_path.with_file_name(temp_name);
            std::fs::write(&temp_path, encoded)
                .map_err(|err| format!("failed to write persisted atoms temp file: {err}"))?;
            if file_path.exists() {
                let _ = std::fs::remove_file(&file_path);
            }
            std::fs::rename(&temp_path, &file_path)
                .map_err(|err| format!("failed to replace persisted atoms file: {err}"))?;
            Ok(())
        })
        .await
        .map_err(|err| format!("failed to persist atoms task: {err}"))?
    }
}
