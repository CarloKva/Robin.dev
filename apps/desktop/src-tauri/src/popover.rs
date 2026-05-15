//! Popover window — frameless, transparent, 380×680, anchored under the tray
//! icon. On macOS we use a borderless `NSPanel`-style window (delivered by
//! Tauri's `decorations: false` + `transparent: true` flags).
//!
//! Light-dismiss (clicking outside) is wired through `on_window_event` — when
//! the popover loses focus we hide it rather than destroy it, so the next
//! tray click can re-show it instantly without recreating the WebView.

use tauri::{AppHandle, LogicalPosition, Manager, PhysicalPosition, Runtime, WebviewWindow};

const POPOVER_LABEL: &str = "popover";
const POPOVER_WIDTH: f64 = 380.0;
const POPOVER_GAP: f64 = 6.0;

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(POPOVER_LABEL) {
        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                if let Some(window) = app_handle.get_webview_window(POPOVER_LABEL) {
                    let _ = window.hide();
                }
            }
        });
    }
    Ok(())
}

pub fn toggle<R: Runtime>(
    app: &AppHandle<R>,
    anchor: Option<PhysicalPosition<f64>>,
) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(POPOVER_LABEL) else {
        return Ok(());
    };
    if window.is_visible().unwrap_or(false) {
        window.hide()?;
        return Ok(());
    }
    if let Some(pos) = anchor {
        anchor_under(&window, pos)?;
    }
    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn anchor_under<R: Runtime>(window: &WebviewWindow<R>, click: PhysicalPosition<f64>) -> tauri::Result<()> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let logical_x = click.x / scale - POPOVER_WIDTH / 2.0;
    let logical_y = click.y / scale + POPOVER_GAP;
    window.set_position(LogicalPosition::new(logical_x.max(8.0), logical_y))?;
    Ok(())
}

#[tauri::command]
pub fn cmd_toggle_popover<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    toggle(&app, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_hide_popover<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPOVER_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
