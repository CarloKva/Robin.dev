//! System-browser URL opener. We don't pull in `tauri-plugin-shell` /
//! `tauri-plugin-opener` because both add a non-trivial allowlist; opening
//! a URL on macOS is a one-line shell-out via `open`.

use std::process::Command;

#[tauri::command]
pub fn cmd_open_url(url: String) -> Result<(), String> {
    if !is_safe_scheme(&url) {
        return Err(format!("refusing to open unsafe url: {url}"));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = url; // suppress unused warning
        Err("URL opening only supported on macOS in v1".to_string())
    }
}

fn is_safe_scheme(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:")
}
