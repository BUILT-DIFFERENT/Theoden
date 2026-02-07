use std::path::PathBuf;

pub fn codex_home_dir() -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("CODEX_HOME") {
        let path = PathBuf::from(value);
        std::fs::create_dir_all(&path)
            .map_err(|err| format!("failed to create CODEX_HOME directory: {err}"))?;
        return Ok(path);
    }

    let home_dir =
        dirs::home_dir().ok_or_else(|| "failed to resolve user home directory".to_string())?;
    let path = home_dir.join(".codex");
    std::fs::create_dir_all(&path)
        .map_err(|err| format!("failed to create ~/.codex directory: {err}"))?;
    Ok(path)
}
