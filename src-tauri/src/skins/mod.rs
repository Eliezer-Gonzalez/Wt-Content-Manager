mod archive;
mod download;
pub mod download_task;
pub mod library;
mod paths;
mod staging;

pub use library::{scan_installed_skins, uninstall_skin, ScannedSkin};
pub use staging::{
    cleanup_orphan_staging, cleanup_orphans, inspect_orphan_staging, is_orphan_staging_dir,
    register_active_staging, unregister_active_staging, TemporaryCleanupOutcome,
    TemporaryFileReport, STAGING_PREFIX, STAGING_SUFFIX_LEN,
};

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tempfile::TempDir;

use crate::{game_install, providers::wt_live, AppError};
use download_task::{DownloadControl, DownloadManager, SkinInstallProgress};

const MAX_SKIN_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub folder_name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
    pub skipped_files: usize,
    pub skipped_executables: usize,
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
        let staging = InstallStaging::new(game_path)?;
        control.begin_download();
        staging
            .download(&download_url, &control, &on_progress)
            .await?;
        control.check_cancelled()?;
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

pub struct InstallStaging {
    userskins: PathBuf,
    archive_path: PathBuf,
    staging_dir: TempDir,
}

impl Drop for InstallStaging {
    fn drop(&mut self) {
        unregister_active_staging(self.staging_dir.path());
    }
}

impl InstallStaging {
    pub fn new(game_path: &str) -> Result<Self, AppError> {
        let game_root = Path::new(game_path);
        if !game_root.is_dir() {
            return Err(AppError::new("game_folder_not_found"));
        }

        let userskins = game_root.join("UserSkins");
        if let Err(error) = std::fs::create_dir_all(&userskins) {
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                return Err(AppError::with_detail(
                    "game_permission_denied",
                    error.to_string(),
                ));
            }
            return Err(AppError::with_detail(
                "userskins_create_failed",
                error.to_string(),
            ));
        }

        cleanup_orphans(game_root);

        let staging = tempfile::Builder::new()
            .prefix(STAGING_PREFIX)
            .rand_bytes(STAGING_SUFFIX_LEN)
            .tempdir_in(game_root)
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::PermissionDenied {
                    AppError::with_detail("game_permission_denied", error.to_string())
                } else {
                    AppError::with_detail("staging_prepare_failed", error.to_string())
                }
            })?;
        let staging_path = staging.path().to_path_buf();
        register_active_staging(staging_path);
        let archive_path = staging.path().join("download.archive");
        Ok(Self {
            userskins,
            archive_path,
            staging_dir: staging,
        })
    }

    pub async fn download(
        &self,
        url: &str,
        control: &DownloadControl,
        channel: &Channel<SkinInstallProgress>,
    ) -> Result<(), AppError> {
        download::download_archive(url, &self.archive_path, control, channel).await
    }

    pub fn extract_and_install(
        self,
        archive_name: &str,
        replace_folder_name: Option<&str>,
    ) -> Result<InstallResult, AppError> {
        let payload = self.staging_dir.path().join("payload");
        std::fs::create_dir(&payload)?;
        let stats = archive::extract(&self.archive_path, &payload, MAX_SKIN_BYTES)?;
        let (source, folder_name) = paths::select_skin_root(&payload, archive_name)?;
        let file_count = paths::count_files(&source)?;
        if file_count == 0 || !paths::contains_skin_definition(&source)? {
            return Err(AppError::new("archive_no_skin_definition"));
        }
        let size_bytes = paths::total_size(&source)?;
        let folder_name = match replace_folder_name {
            Some(name) => name.to_string(),
            None => paths::unique_folder_name(&self.userskins, &folder_name)?,
        };
        let destination = self.userskins.join(&folder_name);
        if let Some(name) = replace_folder_name {
            let backup = self.staging_dir.path().join("previous-skin");
            library::replace_skin_folder(&self.userskins, name, &source, &backup)?;
        } else {
            std::fs::rename(&source, &destination)
                .map_err(|error| AppError::with_detail("skin_save_failed", error.to_string()))?;
        }

        Ok(InstallResult {
            folder_name,
            path: destination.to_string_lossy().to_string(),
            file_count,
            size_bytes,
            skipped_files: stats.skipped_files,
            skipped_executables: stats.skipped_executables,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{InstallStaging, STAGING_PREFIX, STAGING_SUFFIX_LEN};
    use std::fs;

    #[test]
    fn dropping_staging_removes_partial_download_and_keeps_user_skins() {
        let game_root = tempfile::tempdir().unwrap();
        let staging = InstallStaging::new(game_root.path().to_str().unwrap()).unwrap();
        let staging_path = staging.archive_path.parent().unwrap().to_path_buf();
        fs::write(&staging.archive_path, b"partial archive").unwrap();
        assert!(staging.archive_path.exists());

        // Check staging is inside game_root, with prefix and exact suffix length
        assert!(staging_path.starts_with(game_root.path()));
        let dir_name = staging_path.file_name().unwrap().to_string_lossy();
        assert!(dir_name.starts_with(STAGING_PREFIX));
        assert_eq!(dir_name.len(), STAGING_PREFIX.len() + STAGING_SUFFIX_LEN);

        drop(staging);

        assert!(!staging_path.exists());
        assert!(game_root.path().join("UserSkins").is_dir());
    }
}
