use super::install_staging::InstallStaging;
use super::duplicate_detection::DuplicateSkinCandidate;
use super::pending_install::PreparedInstallRegistry;
use serde::Serialize;
use tauri::ipc::Channel;

use super::download_task::{DownloadManager, SkinInstallProgress};
use crate::{game_install, providers::wt_live, AppError};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub folder_name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
    pub skipped_files: usize,
    pub skipped_executables: usize,
    pub missing_texture_count: usize,
    pub missing_texture_names: Vec<String>,
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum SkinInstallOutcome {
    Installed { result: InstallResult },
    DuplicateFound { pending_id: String, candidates: Vec<DuplicateSkinCandidate> },
    LinkedExisting { folder_name: String, path: String },
    Cancelled,
}

pub async fn install_skin(
    lang_group: u64,
    game_path: &str,
    task_id: &str,
    replace_folder_name: Option<&str>,
    on_progress: Channel<SkinInstallProgress>,
    manager: &DownloadManager,
    pending: &PreparedInstallRegistry,
    external_folder_names: Vec<String>,
) -> Result<SkinInstallOutcome, AppError> {
    let replace_folder_name = replace_folder_name.map(str::to_owned);
    let control = manager.register(task_id)?;
    let result = async {
        on_progress
            .send(SkinInstallProgress {
                phase: "preparing",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            })
            .map_err(|error| {
                AppError::with_detail("download_progress_failed", error.to_string())
            })?;
        game_install::validate(game_path)?;
        let (download_url, archive_name) = wt_live::skin_download_source(lang_group).await?;
        control.check_cancelled()?;
        let staging_game_path = game_path.to_string();
        let staging =
            tauri::async_runtime::spawn_blocking(move || InstallStaging::new(&staging_game_path))
                .await
                .map_err(|error| {
                    AppError::with_detail("staging_prepare_failed", error.to_string())
                })??;
        control.begin_download();
        staging
            .download(&download_url, &control, &on_progress)
            .await?;
        control.wait_until_resumed().await?;
        control.begin_extraction();
        on_progress
            .send(SkinInstallProgress {
                phase: "extracting",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            })
            .map_err(|error| {
                AppError::with_detail("download_progress_failed", error.to_string())
            })?;
        let task_id_for_pending = task_id.to_string();
        let prepare_progress = on_progress.clone();
        let prepared = tauri::async_runtime::spawn_blocking(move || -> Result<Preparation, AppError> {
            let (prepared, candidates) = staging.prepare(&archive_name, replace_folder_name.as_deref(), &external_folder_names, &prepare_progress, &control)?;
            control.wait_until_resumed_blocking()?;
            if candidates.is_empty() {
                Ok(Preparation::Installed(prepared.install()?))
            } else {
                Ok(Preparation::NeedsChoice(prepared, candidates))
            }
        })
        .await
        .map_err(|error| AppError::with_detail("skin_install_interrupted", error.to_string()))??;
        match prepared {
            Preparation::Installed(result) => Ok(SkinInstallOutcome::Installed { result }),
            Preparation::NeedsChoice(prepared, candidates) => {
                let registry = pending.clone();
                let pending_id = task_id_for_pending;
                let (pending_id, candidates) = tauri::async_runtime::spawn_blocking(move || {
                    registry.insert(pending_id.clone(), prepared, candidates.clone())?;
                    Ok::<_, AppError>((pending_id, candidates))
                })
                .await
                .map_err(|error| AppError::with_detail("skin_install_interrupted", error.to_string()))??;
                Ok(SkinInstallOutcome::DuplicateFound { pending_id, candidates })
            }
        }
    }
    .await;
    manager.finish(task_id);
    result
}

enum Preparation {
    Installed(InstallResult),
    NeedsChoice(super::install_staging::PreparedSkinInstall, Vec<DuplicateSkinCandidate>),
}

pub fn resolve_prepared_skin_install(
    pending: &PreparedInstallRegistry,
    pending_id: &str,
    action: &str,
    folder_name: Option<&str>,
) -> Result<SkinInstallOutcome, AppError> {
    let (prepared, candidates) = pending.take(pending_id)?;
    match action {
        "install_copy" => Ok(SkinInstallOutcome::Installed { result: prepared.install()? }),
        "link_existing" => {
            let Some(folder_name) = folder_name else {
                pending.insert(pending_id.to_string(), prepared, candidates)?;
                return Err(AppError::new("skin_duplicate_changed"));
            };
            if !candidates.iter().any(|candidate| candidate.folder_name.eq_ignore_ascii_case(folder_name)) {
                pending.insert(pending_id.to_string(), prepared, candidates)?;
                return Err(AppError::new("skin_duplicate_changed"));
            }
            match prepared.validate_external_folder(folder_name) {
                Ok(result) => Ok(SkinInstallOutcome::LinkedExisting { folder_name: result.folder_name, path: result.path }),
                Err(error) => {
                    pending.insert(pending_id.to_string(), prepared, candidates)?;
                    Err(error)
                }
            }
        }
        "replace_existing" => {
            let Some(folder_name) = folder_name else {
                pending.insert(pending_id.to_string(), prepared, candidates)?;
                return Err(AppError::new("skin_duplicate_changed"));
            };
            if !candidates.iter().any(|candidate| candidate.folder_name.eq_ignore_ascii_case(folder_name)) {
                pending.insert(pending_id.to_string(), prepared, candidates)?;
                return Err(AppError::new("skin_duplicate_changed"));
            }
            if let Err(error) = prepared.validate_external_folder(folder_name) {
                pending.insert(pending_id.to_string(), prepared, candidates)?;
                return Err(error);
            }
            Ok(SkinInstallOutcome::Installed { result: prepared.target_existing_folder(folder_name).install()? })
        }
        "cancel" => Ok(SkinInstallOutcome::Cancelled),
        _ => {
            pending.insert(pending_id.to_string(), prepared, candidates)?;
            Err(AppError::new("skin_duplicate_choice_invalid"))
        }
    }
}

pub fn cancel_prepared_skin_install(pending: &PreparedInstallRegistry, pending_id: &str) -> Result<(), AppError> {
    pending.cancel(pending_id)
}
