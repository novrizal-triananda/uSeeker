mod proxy;

use std::sync::Mutex;

/// State holding the sidecar child process handle
struct SidecarState {
    child: Mutex<Option<u32>>,
}

/// Save a configuration value (API key, provider, etc.) to disk
#[tauri::command]
fn save_config(key: String, value: String) -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("useeker");

    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.json");

    let mut config: serde_json::Value = if config_path.exists() {
        let data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    config[&key] = serde_json::Value::String(value);

    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, data).map_err(|e| e.to_string())?;

    Ok(())
}

/// Read a configuration value from disk
#[tauri::command]
fn read_config(key: String) -> Result<Option<String>, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("useeker");

    let config_path = config_dir.join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    match config.get(&key) {
        Some(serde_json::Value::String(s)) => Ok(Some(s.clone())),
        _ => Ok(None),
    }
}

/// Get all AI configuration from disk (for Settings UI).
/// Returns structured JSON with baseUrl, model, and full apiKey.
#[tauri::command]
fn get_ai_config() -> Result<serde_json::Value, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("useeker");
    let config_path = config_dir.join("config.json");
    if !config_path.exists() {
        return Ok(serde_json::json!({
            "apiKey": "",
            "baseUrl": "",
            "model": "",
        }));
    }
    let data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    let api_key = config.get("api_key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let base_url = config.get("base_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let model = config.get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(serde_json::json!({
        "apiKey": api_key,
        "baseUrl": base_url,
        "model": model,
    }))
}

// ── Database storage (JSON file via Rust backend) ──

/// Base directory for useeker data files
fn data_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("useeker").join("data");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Load entire database from JSON file
#[tauri::command]
fn load_database() -> Result<Option<String>, String> {
    let dir = data_dir()?;
    let path = dir.join("database.json");
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string()).map(Some)
}

/// Save entire database to JSON file
#[tauri::command]
fn save_database(data: String) -> Result<(), String> {
    let dir = data_dir()?;
    let path = dir.join("database.json");
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Backup system ──

/// Backup directory for database exports
fn backup_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("useeker")
        .join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Save database backup (JSON content from Dexie exportAll)
#[tauri::command]
fn backup_database(data: String) -> Result<String, String> {
    let dir = backup_dir()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let filename = format!("backup-{}.json", now);
    let path = dir.join(&filename);
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;

    // Keep only last 5 backups
    let mut entries: Vec<_> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
        .filter_map(|e| {
            let metadata = e.metadata().ok()?;
            Some((e.path(), metadata.modified().ok()?))
        })
        .collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in entries.into_iter().skip(5) {
        let _ = std::fs::remove_file(path);
    }

    Ok(filename)
}

/// Get latest backup content
#[tauri::command]
fn restore_database() -> Result<Option<String>, String> {
    let dir = backup_dir()?;
    if !dir.exists() {
        return Ok(None);
    }
    let mut entries: Vec<_> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
        .filter_map(|e| {
            let metadata = e.metadata().ok()?;
            Some((e.path(), metadata.modified().ok()?))
        })
        .collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    let latest = entries.into_iter().next().map(|(p, _)| p);
    match latest {
        Some(path) => {
            let data = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
            Ok(Some(data))
        }
        None => Ok(None),
    }
}

/// Export data to a user-selected file path
#[tauri::command]
fn export_to_file(path: String, data: String) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(())
}

/// Import data from a user-selected file path
#[tauri::command]
fn import_from_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands
            save_config,
            read_config,
            get_ai_config,
            // Database commands
            load_database,
            save_database,
            // Backup commands
            backup_database,
            restore_database,
            export_to_file,
            import_from_file,
            // Proxy commands
            proxy::call_ai,
            proxy::search_web,
            proxy::fetch_url,
            proxy::scrape_url,
            proxy::check_health,
            proxy::check_update,
            proxy::run_agent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
