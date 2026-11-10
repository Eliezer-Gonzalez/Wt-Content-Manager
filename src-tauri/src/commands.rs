use serde_json::Value;
use std::path::PathBuf;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::{game_install, logging, providers::wt_live, skins, AppError};

pub(crate) fn record_failure<T>(
    logger: &logging::DiagnosticLogger,
    source: &str,
    result: Result<T, AppError>,
) -> Result<T, AppError> {
    if let Err(error) = &result {
        if error.code != "download_cancelled" {
            let message = error
                .params
                .as_ref()
                .and_then(|params| serde_json::to_string(params).ok())
                .map_or_else(
                    || error.code.clone(),
                    |params| format!("{} {params}", error.code),
                );
            let message = error
                .detail
                .as_deref()
                .map_or(message.clone(), |detail| format!("{message}; detail: {detail}"));
            let _ = logger.write("error", source, &message);
        }
    }
    result
}

#[tauri::command]
pub async fn fetch_recent_camouflages(
    search_string: String,
    period: u32,
    page: u32,
    sort: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<Value, AppError> {
    let result = wt_live::recent_camouflages(&search_string, period, page, &sort).await;
    record_failure(&logger, "fetch_recent_camouflages", result)
}

#[tauri::command]
pub async fn fetch_recent_sounds(
    search_string: String,
    period: u32,
    page: u32,
    sort: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<Value, AppError> {
    let result = wt_live::recent_sounds(&search_string, period, page, &sort).await;
    record_failure(&logger, "fetch_recent_sounds", result)
}

#[tauri::command]
pub async fn fetch_post_detail(
    lang_group: u64,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<Value, AppError> {
    let result = wt_live::post_detail(lang_group).await;
    record_failure(&logger, "fetch_post_detail", result)
}

#[tauri::command]
pub fn detect_game_installations() -> Vec<game_install::GameInstall> {
    game_install::detect()
}

#[tauri::command]
pub fn validate_game_installation(
    path: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<game_install::GameInstall, AppError> {
    let result = game_install::validate(&path);
    record_failure(&logger, "validate_game_installation", result)
}

#[tauri::command]
pub async fn install_skin(
    lang_group: u64,
    game_path: String,
    task_id: String,
    replace_folder_name: Option<String>,
    on_progress: Channel<skins::download_task::SkinInstallProgress>,
    manager: State<'_, skins::download_task::DownloadManager>,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<skins::InstallResult, AppError> {
    let result = skins::install_skin(
        lang_group,
        &game_path,
        &task_id,
        replace_folder_name.as_deref(),
        on_progress,
        &manager,
    )
    .await;
    record_failure(&logger, "install_skin", result)
}

#[tauri::command]
pub fn set_skin_download_paused(
    task_id: String,
    paused: bool,
    manager: State<'_, skins::download_task::DownloadManager>,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    let result = manager.set_paused(&task_id, paused);
    record_failure(&logger, "set_skin_download_paused", result)
}

#[tauri::command]
pub fn cancel_skin_download(
    task_id: String,
    manager: State<'_, skins::download_task::DownloadManager>,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    let result = manager.cancel(&task_id);
    record_failure(&logger, "cancel_skin_download", result)
}

#[tauri::command]
pub async fn scan_installed_skins(
    game_path: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<Vec<skins::ScannedSkin>, AppError> {
    let result =
        tauri::async_runtime::spawn_blocking(move || skins::scan_installed_skins(&game_path))
            .await
            .map_err(|error| AppError::with_detail("skin_scan_interrupted", error.to_string()))
            .and_then(|result| result);
    record_failure(&logger, "scan_installed_skins", result)
}

#[tauri::command]
pub async fn uninstall_skin(
    game_path: String,
    folder_name: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        skins::uninstall_skin(&game_path, &folder_name)
    })
    .await
    .map_err(|error| AppError::with_detail("skin_uninstall_interrupted", error.to_string()))
    .and_then(|result| result);
    record_failure(&logger, "uninstall_skin", result)
}

#[tauri::command]
pub fn get_diagnostic_settings(
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<logging::DiagnosticSettings, AppError> {
    logger
        .settings()
        .map_err(|_| AppError::new("diagnostics_unavailable"))
}

#[tauri::command]
pub fn set_diagnostic_logging_enabled(
    enabled: bool,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    logger
        .set_enabled(enabled)
        .map_err(|_| AppError::new("diagnostics_settings_failed"))
}

#[tauri::command]
pub fn write_diagnostic(
    level: String,
    source: String,
    message: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    if source.len() > 160 || message.len() > 8_000 {
        return Err(AppError::new("diagnostic_entry_too_large"));
    }
    logger
        .write(&level, &source, &message)
        .map_err(|_| AppError::new("diagnostics_write_failed"))
}

#[tauri::command]
pub fn read_recent_diagnostics(
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<String, AppError> {
    logger
        .read_recent()
        .map_err(|_| AppError::new("diagnostics_read_failed"))
}

#[tauri::command]
pub fn open_diagnostics_folder(
    app: AppHandle,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    let path: PathBuf = logger
        .directory()
        .map_err(|_| AppError::new("diagnostics_unavailable"))?;
    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|_| AppError::new("diagnostics_open_folder_failed"))
}
