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
        self.persist(&atoms)
    }

    pub async fn reset(&self, key: String) -> Result<(), String> {
        let mut atoms = self.atoms.lock().await;
        atoms.remove(&key);
        self.persist(&atoms)
    }

    fn persist(&self, atoms: &HashMap<String, Value>) -> Result<(), String> {
        let encoded = serde_json::to_string_pretty(atoms)
            .map_err(|err| format!("failed to serialize persisted atoms: {err}"))?;
        std::fs::write(&self.file_path, encoded)
            .map_err(|err| format!("failed to write persisted atoms file: {err}"))?;
        Ok(())
    }
}
