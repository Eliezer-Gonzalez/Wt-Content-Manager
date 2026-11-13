use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::commands::record_failure;
use crate::{logging::DiagnosticLogger, skins::download_task::DownloadManager, AppError};

use super::types::{
    ExistingSoundModAction, SoundInstallPreflight, SoundInstallResult, SoundModStatus, SoundPackage,
};

#[tauri::command]
pub async fn open_sound_mod_folder(app: AppHandle, game_path: String) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let _mutation = crate::skins::recovery::lock_game_filesystem();
        let install = crate::game_install::validate(&game_path)?;
        let game_root = Path::new(&install.path);
        super::files::ensure_sound_directory(game_root)?;
        let folder = super::files::sound_mod_path(game_root)?;
        if !folder.exists() {
            fs::create_dir(&folder).map_err(|error| {
                AppError::with_detail("sound_mod_folder_create_failed", error.to_string())
            })?;
        }
        super::files::reject_symlink_or_non_directory(&folder)?;
        app.opener()
            .open_path(folder.to_string_lossy().into_owned(), None::<&str>)
            .map_err(|error| {
                AppError::with_detail("sound_mod_folder_open_failed", error.to_string())
            })
    })
    .await
    .map_err(|error| AppError::with_detail("sound_mod_folder_open_failed", error.to_string()))?
}

#[tauri::command]
pub async fn open_sound_package_library_folder(app: AppHandle) -> Result<(), AppError> {
    let folder = super::library::packages_root(&app_data_dir(&app)?);
    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&folder).map_err(|error| {
            AppError::with_detail("sound_package_library_open_failed", error.to_string())
        })?;
        app.opener()
            .open_path(folder.to_string_lossy().into_owned(), None::<&str>)
            .map_err(|error| {
                AppError::with_detail("sound_package_library_open_failed", error.to_string())
            })
    })
    .await
    .map_err(|error| {
        AppError::with_detail("sound_package_library_open_failed", error.to_string())
    })?
}

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
pub async fn update_sound_package(
    app: AppHandle,
    package_id: String,
    expected_revision: u64,
    task_id: String,
    on_progress: Channel<crate::skins::download_task::SkinInstallProgress>,
    manager: State<'_, DownloadManager>,
    logger: State<'_, DiagnosticLogger>,
) -> Result<SoundPackage, AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => {
            super::update_package(
                &path,
                &package_id,
                expected_revision,
                &task_id,
                on_progress,
                &manager,
            )
            .await
        }
        Err(error) => Err(error),
    };
    record_failure(&logger, "update_sound_package", result)
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
pub async fn get_sound_install_preflight(
    app: AppHandle,
    game_path: String,
) -> Result<SoundInstallPreflight, AppError> {
    let path = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || super::install_preflight(&path, &game_path))
        .await
        .map_err(|error| AppError::with_detail("sound_status_interrupted", error.to_string()))?
}

#[tauri::command]
pub async fn install_sound_package(
    app: AppHandle,
    game_path: String,
    package_id: String,
    existing_mod_action: Option<ExistingSoundModAction>,
    logger: State<'_, DiagnosticLogger>,
) -> Result<SoundInstallResult, AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => tauri::async_runtime::spawn_blocking(move || {
            super::install(&path, &game_path, &package_id, existing_mod_action)
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

#[tauri::command]
pub async fn uninstall_sound_mod(
    app: AppHandle,
    game_path: String,
    logger: State<'_, DiagnosticLogger>,
) -> Result<(), AppError> {
    let result = match app_data_dir(&app) {
        Ok(path) => {
            tauri::async_runtime::spawn_blocking(move || super::uninstall(&path, &game_path))
                .await
                .map_err(|error| {
                    AppError::with_detail("sound_uninstall_interrupted", error.to_string())
                })
                .and_then(|result| result)
        }
        Err(error) => Err(error),
    };
    record_failure(&logger, "uninstall_sound_mod", result)
}
