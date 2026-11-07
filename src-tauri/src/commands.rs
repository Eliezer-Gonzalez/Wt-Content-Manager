use serde_json::Value;

use crate::{game_install, providers::wt_live};

#[tauri::command]
pub async fn fetch_recent_camouflages() -> Result<Value, String> {
    wt_live::recent_camouflages().await
}

#[tauri::command]
pub async fn fetch_post_detail(lang_group: u64) -> Result<Value, String> {
    wt_live::post_detail(lang_group).await
}

#[tauri::command]
pub fn detect_game_installations() -> Vec<game_install::GameInstall> {
    game_install::detect()
}

#[tauri::command]
pub fn validate_game_installation(path: String) -> Result<game_install::GameInstall, String> {
    game_install::validate(&path)
}
