//! Native notifications. The renderer decides *when* to fire (it owns the
//! Realtime `task_events` subscription). Rust just delivers the banner.

use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn cmd_notify<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: String,
    deeplink: Option<String>,
) -> Result<(), String> {
    // The plugin no longer exposes `identifier` on the builder; the deeplink
    // is round-tripped via the renderer's notification subscription instead.
    let _ = deeplink;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}
