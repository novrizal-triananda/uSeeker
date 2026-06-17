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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands (existing)
            save_config,
            read_config,
            // Proxy commands (new — replaces Node.js server)
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
