use std::path::PathBuf;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::commands::record_failure;
use crate::{logging::DiagnosticLogger, skins::download_task::DownloadManager, AppError};

use super::types::{SoundInstallResult, SoundModStatus, SoundPackage};

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|error| AppError::with_detail("sound_library_unavailable", error.to_string()))
}

#[tauri::command]
pub async fn list_sound_packages(app: AppHandle) -> Result<Vec<SoundPackage>, AppError> {
    let path = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || super::list_packages(&path))
        .await
        .map_err(|error| AppError::with_detail("sound_library_unavailable", error.to_string()))?
}

#[tauri::command]
pub async fn download_sound_package(
    app: AppHandle,
    lang_group: u64,
    title: String,
    author: String,
    task_id: String,
    on_progress: Channel<crate::skins::download_task::SkinInstallProgress>,
    manager: State<'_, DownloadManager>,
    logger: State<'_, DiagnosticLogger>,
) -> Result<SoundPackage, AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => {
            super::download_package(
                &path,
                lang_group,
                title,
                author,
                &task_id,
                on_progress,
                &manager,
            )
            .await
        }
        Err(error) => Err(error),
    };
    record_failure(&logger, "download_sound_package", result)
}

#[tauri::command]
pub fn set_sound_download_paused(
    task_id: String,
    paused: bool,
    manager: State<'_, DownloadManager>,
) -> Result<(), AppError> {
    manager.set_paused(&task_id, paused)
}

#[tauri::command]
pub fn cancel_sound_download(
    task_id: String,
    manager: State<'_, DownloadManager>,
) -> Result<(), AppError> {
    manager.cancel(&task_id)
}

#[tauri::command]
pub async fn get_sound_mod_status(
    app: AppHandle,
    game_path: String,
) -> Result<SoundModStatus, AppError> {
    let path = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || super::status(&path, &game_path))
        .await
        .map_err(|error| AppError::with_detail("sound_status_interrupted", error.to_string()))?
}

#[tauri::command]
pub async fn install_sound_package(
    app: AppHandle,
    game_path: String,
    package_id: String,
    logger: State<'_, DiagnosticLogger>,
) -> Result<SoundInstallResult, AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => tauri::async_runtime::spawn_blocking(move || {
            super::install(&path, &game_path, &package_id)
        })
        .await
        .map_err(|error| AppError::with_detail("sound_install_interrupted", error.to_string()))
        .and_then(|result| result),
        Err(error) => Err(error),
    };
    record_failure(&logger, "install_sound_package", result)
}

#[tauri::command]
pub async fn restore_sound_mod_backup(
    app: AppHandle,
    game_path: String,
    logger: State<'_, DiagnosticLogger>,
) -> Result<(), AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => tauri::async_runtime::spawn_blocking(move || super::restore(&path, &game_path))
            .await
            .map_err(|error| AppError::with_detail("sound_restore_interrupted", error.to_string()))
            .and_then(|result| result),
        Err(error) => Err(error),
    };
    record_failure(&logger, "restore_sound_mod_backup", result)
}
