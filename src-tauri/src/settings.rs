use std::{fs, path::Path};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::{game_install, skins, AppError};

#[tauri::command]
pub async fn get_orphan_temporary_files(
    app: AppHandle,
    game_path: String,
) -> Result<skins::TemporaryFileReport, AppError> {
    let install = game_install::validate(&game_path)?;
    let library_path = app.path().app_data_dir().map_err(|error| AppError::with_detail("local_library_path_failed", error.to_string()))?.join("local-library.json");
    tauri::async_runtime::spawn_blocking(move || {
        skins::install_journal::reconcile(&library_path)?;
        skins::inspect_orphan_staging(Path::new(&install.path))
            .map_err(|error| AppError::with_detail("temporary_files_scan_failed", error.to_string()))
    })
    .await
    .map_err(|error| AppError::with_detail("temporary_files_scan_failed", error.to_string()))?
}

#[tauri::command]
pub async fn cleanup_orphan_temporary_files(
    app: AppHandle,
    game_path: String,
) -> Result<skins::TemporaryCleanupOutcome, AppError> {
    let install = game_install::validate(&game_path)?;
    let library_path = app.path().app_data_dir().map_err(|error| AppError::with_detail("local_library_path_failed", error.to_string()))?.join("local-library.json");
    tauri::async_runtime::spawn_blocking(move || {
        skins::install_journal::reconcile(&library_path)?;
        skins::cleanup_orphan_staging(Path::new(&install.path))
            .map_err(|error| AppError::with_detail("temporary_files_cleanup_failed", error.to_string()))
    })
    .await
    .map_err(|error| AppError::with_detail("temporary_files_cleanup_failed", error.to_string()))?
}

#[tauri::command]
pub fn open_user_skins_folder(app: AppHandle, game_path: String) -> Result<(), AppError> {
    let install = game_install::validate(&game_path)?;
    let folder = Path::new(&install.path).join("UserSkins");
    fs::create_dir_all(&folder)
        .map_err(|error| AppError::with_detail("userskins_create_failed", error.to_string()))?;
    app.opener()
        .open_path(folder.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| AppError::with_detail("userskins_open_failed", error.to_string()))
}
