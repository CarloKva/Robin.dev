//! `robin://` deep-link routing.
//!
//! Supported URLs:
//!   robin://auth/callback?state=<state>&code=<code>
//!   robin://task/<uuid>
//!   robin://agent/<uuid>
//!
//! We hand the parsed payload to the renderer via the `deeplink:received`
//! event; the React side has a router-aware listener (`src/lib/router/deeplink.ts`).

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

#[derive(Debug, Clone, Serialize)]
pub struct DeepLinkPayload {
    pub kind: String,
    pub path: String,
    pub raw: String,
}

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let app_handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            let _ = forward(&app_handle, url.as_str());
        }
    });
    Ok(())
}

pub fn handle_argv<R: Runtime>(app: &AppHandle<R>, argv: Vec<String>) {
    for arg in argv.iter() {
        if arg.starts_with("robin://") {
            let _ = forward(app, arg);
        }
    }
}

fn forward<R: Runtime>(app: &AppHandle<R>, raw: &str) -> Result<(), String> {
    let url = Url::parse(raw).map_err(|e| e.to_string())?;
    let kind = url.host_str().unwrap_or_default().to_string();
    let path = url.path().to_string();
    let payload = DeepLinkPayload {
        kind,
        path,
        raw: raw.to_string(),
    };
    app.emit("deeplink:received", &payload)
        .map_err(|e| e.to_string())?;
    Ok(())
}
