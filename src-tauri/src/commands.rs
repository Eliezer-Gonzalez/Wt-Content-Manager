use serde_json::Value;

use crate::{game_install, providers::wt_live, skins};

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

#[tauri::command]
pub async fn install_skin(
    lang_group: u64,
    game_path: String,
) -> Result<skins::InstallResult, String> {
    game_install::validate(&game_path)?;
    let (download_url, archive_name) = wt_live::skin_download_source(lang_group).await?;
    tauri::async_runtime::spawn_blocking(move || {
        skins::download_and_install(&download_url, &archive_name, &game_path)
    })
    .await
    .map_err(|error| format!("La instalación de la skin se interrumpió: {error}"))?
}
