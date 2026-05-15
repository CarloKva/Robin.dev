//! Robin.dev desktop — Tauri shell.
//!
//! Composition root for the macOS menu-bar client. The renderer lives in
//! `apps/desktop/src/` (Vite + React + TanStack Router). This crate owns:
//!
//! - Tray icon + popover window toggle (`tray`)
//! - Expanded window lifecycle (`expanded`)
//! - System-browser OAuth + Keychain-stored session (`auth`)
//! - `robin://` deep-link routing (`deeplink`)
//! - Native notification fanout (`notifications`)
//!
//! Each module exposes a small handful of `tauri::command`s so the renderer
//! can drive native flows over IPC without managing platform plumbing itself.

mod auth;
mod deeplink;
mod expanded;
mod notifications;
mod popover;
mod tray;

use tauri::Manager;

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("popover") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            deeplink::handle_argv(app, args);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            tray::install(app.handle())?;
            popover::install(app.handle())?;
            expanded::install(app.handle())?;
            deeplink::install(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::cmd_start_sign_in,
            auth::cmd_complete_sign_in,
            auth::cmd_store_session,
            auth::cmd_load_session,
            auth::cmd_clear_session,
            popover::cmd_toggle_popover,
            popover::cmd_hide_popover,
            expanded::cmd_show_expanded,
            expanded::cmd_focus_agent,
            notifications::cmd_notify,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
