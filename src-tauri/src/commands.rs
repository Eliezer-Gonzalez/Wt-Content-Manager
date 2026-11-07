use serde_json::Value;
use tauri::{ipc::Channel, State};

use crate::{game_install, providers::wt_live, skins};

#[tauri::command]
pub async fn fetch_recent_camouflages(
    search_string: String,
    period: u32,
    page: u32,
    sort: String,
) -> Result<Value, String> {
    wt_live::recent_camouflages(&search_string, period, page, &sort).await
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
    task_id: String,
    on_progress: Channel<skins::download_task::SkinInstallProgress>,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<skins::InstallResult, String> {
    skins::install_skin(lang_group, &game_path, &task_id, on_progress, &manager).await
}

#[tauri::command]
pub fn set_skin_download_paused(
    task_id: String,
    paused: bool,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<(), String> {
    manager.set_paused(&task_id, paused)
}

#[tauri::command]
pub fn cancel_skin_download(
    task_id: String,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<(), String> {
    manager.cancel(&task_id)
}
