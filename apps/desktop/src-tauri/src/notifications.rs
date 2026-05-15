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
    let mut builder = app.notification().builder().title(title).body(body);
    if let Some(link) = deeplink {
        // macOS doesn't surface notification-click payloads to Tauri reliably;
        // we encode the deeplink in the notification id so the renderer can
        // look it up if/when activation reaches us.
        builder = builder.identifier(link);
    }
    builder.show().map_err(|e| e.to_string())
}
