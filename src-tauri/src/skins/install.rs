use super::install_staging::InstallStaging;
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

pub async fn install_skin(
    lang_group: u64,
    game_path: &str,
    task_id: &str,
    replace_folder_name: Option<&str>,
    on_progress: Channel<SkinInstallProgress>,
    manager: &DownloadManager,
) -> Result<InstallResult, AppError> {
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
        tauri::async_runtime::spawn_blocking(move || {
            staging.extract_and_install(&archive_name, replace_folder_name.as_deref())
        })
        .await
        .map_err(|error| AppError::with_detail("skin_install_interrupted", error.to_string()))?
    }
    .await;
    manager.finish(task_id);
    result
}
