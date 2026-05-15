//! Expanded window — the 1100×680 second window used for per-agent chat and
//! Settings subpages. Single instance; show/focus on re-request.

use tauri::{AppHandle, Manager, Runtime};

const LABEL: &str = "expanded";

pub fn install<R: Runtime>(_app: &AppHandle<R>) -> tauri::Result<()> {
    // Window is declared in tauri.conf.json with `visible: false`. We don't
    // create it on launch — the renderer requests it via `cmd_show_expanded`.
    Ok(())
}

#[tauri::command]
pub fn cmd_show_expanded<R: Runtime>(
    app: AppHandle<R>,
    agent_id: Option<String>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Err(format!("window '{LABEL}' not found"));
    };
    if let Some(id) = agent_id {
        let target = format!("/expanded/agents/{id}");
        let _ = window.eval(&format!(
            "window.history.replaceState({{}}, '', {url:?}); window.dispatchEvent(new Event('popstate'))",
            url = target,
        ));
    }
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cmd_focus_agent<R: Runtime>(app: AppHandle<R>, agent_id: String) -> Result<(), String> {
    cmd_show_expanded(app, Some(agent_id))
}
