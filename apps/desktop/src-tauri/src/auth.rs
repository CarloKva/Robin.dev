//! Macos Keychain-backed session store.
//!
//! The renderer drives the PKCE/exchange flow (`apps/desktop/src/lib/auth/session.ts`).
//! Rust's only job is to persist the resulting bundle to Keychain so it
//! survives app restart and is never written to plain disk.

use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

const KEYCHAIN_SERVICE: &str = "dev.robin.desktop";
const KEYCHAIN_ACCOUNT: &str = "session";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSession {
    pub supabase_jwt: String,
    pub refresh_token: String,
    pub expires_at: i64,
    pub workspace_id: Option<String>,
    pub user_id: String,
}

#[tauri::command]
pub fn cmd_start_sign_in() -> Result<String, String> {
    // Renderer owns the PKCE flow; this command is kept for symmetry so the
    // TS side has a single "starting sign-in…" hook to emit telemetry on.
    Ok("started".to_string())
}

#[tauri::command]
pub fn cmd_complete_sign_in<R: Runtime>(_app: AppHandle<R>) -> Result<(), String> {
    // No-op on Rust side; the renderer's session.ts:completeSignIn() does
    // the HTTP exchange and then calls cmd_store_session.
    Ok(())
}

#[tauri::command]
pub fn cmd_store_session<R: Runtime>(
    app: AppHandle<R>,
    payload: StoredSession,
) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
    let serialized = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    entry.set_password(&serialized).map_err(|e| e.to_string())?;
    let _ = app.emit("auth:session-changed", &payload);
    Ok(())
}

#[tauri::command]
pub fn cmd_load_session() -> Result<Option<StoredSession>, String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(serialized) => Ok(Some(
            serde_json::from_str::<StoredSession>(&serialized).map_err(|e| e.to_string())?,
        )),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn cmd_clear_session<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            let _ = app.emit("auth:session-cleared", ());
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}
