//! Menu-bar tray icon. Left-click toggles the popover; right-click opens a
//! Quit / Sign out / Preferences menu.
//!
//! macOS-specific: the popover is anchored under the tray icon via the
//! position returned by `TrayIconEvent::Click`. We avoid `tauri-plugin-positioner`
//! and do the math inline so we keep the dependency surface minimal.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::popover;

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Quit Robin", true, Some("CmdOrCtrl+Q"))?;
    let sign_out = MenuItem::with_id(app, "sign-out", "Sign out", true, None::<&str>)?;
    let prefs = MenuItem::with_id(app, "prefs", "Preferences…", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&prefs, &sign_out, &quit])?;

    TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "sign-out" => {
                if let Some(window) = app.get_webview_window("popover") {
                    let _ = window.eval("window.dispatchEvent(new CustomEvent('robin:sign-out'))");
                }
            }
            "prefs" => {
                if let Some(window) = app.get_webview_window("popover") {
                    let _ = window.eval(
                        "window.dispatchEvent(new CustomEvent('robin:open-preferences'))",
                    );
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                let app = tray.app_handle();
                popover::toggle(app, Some(position)).ok();
            }
        })
        .build(app)?;

    Ok(())
}
