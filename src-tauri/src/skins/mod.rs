mod archive;
mod download;
pub mod download_task;
mod paths;

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

pub const STAGING_PREFIX: &str = ".wtcm-staging-";
pub const STAGING_SUFFIX_LEN: usize = 16;
pub const DEFAULT_ORPHAN_AGE_THRESHOLD: std::time::Duration =
    std::time::Duration::from_secs(10 * 60);

static ACTIVE_STAGING_DIRS: std::sync::Mutex<Option<std::collections::HashSet<PathBuf>>> =
    std::sync::Mutex::new(None);

pub fn register_active_staging(path: PathBuf) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        lock.get_or_insert_with(std::collections::HashSet::new)
            .insert(path);
    }
}

pub fn unregister_active_staging(path: &Path) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_mut() {
            set.remove(path);
        }
    }
}

pub fn is_active_staging(path: &Path) -> bool {
    if let Ok(lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_ref() {
            return set.contains(path);
        }
    }
    false
}

pub fn is_orphan_staging_dir(name: &str) -> bool {
    let Some(suffix) = name.strip_prefix(STAGING_PREFIX) else {
        return false;
    };
    suffix.len() == STAGING_SUFFIX_LEN && suffix.chars().all(|c| c.is_ascii_alphanumeric())
}

pub fn cleanup_orphans(game_root: &Path) {
    cleanup_orphans_with_threshold(game_root, DEFAULT_ORPHAN_AGE_THRESHOLD);
}

pub fn cleanup_orphans_with_threshold(game_root: &Path, age_threshold: std::time::Duration) {
    let Ok(entries) = std::fs::read_dir(game_root) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();
        if !is_orphan_staging_dir(&name_str) {
            continue;
        }

        let entry_path = entry.path();
        if is_active_staging(&entry_path) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            if let Ok(modified) = metadata.modified() {
                match modified.elapsed() {
                    Ok(elapsed) if elapsed < age_threshold => {
                        continue;
                    }
                    Err(_) => {
                        continue;
                    }
                    _ => {}
                }
            }
        }

        let _ = std::fs::remove_dir_all(&entry_path);
    }
}

pub async fn install_skin(
    lang_group: u64,
    game_path: &str,
    task_id: &str,
    on_progress: Channel<SkinInstallProgress>,
    manager: &DownloadManager,
) -> Result<InstallResult, AppError> {
    let control = manager.register(task_id)?;
    let result = async {
        on_progress
            .send(SkinInstallProgress {
                phase: "preparing",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            })
            .map_err(|error| AppError::with_detail("download_progress_failed", error.to_string()))?;
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
            .map_err(|error| AppError::with_detail("download_progress_failed", error.to_string()))?;
        tauri::async_runtime::spawn_blocking(move || staging.extract_and_install(&archive_name))
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
                return Err(AppError::with_detail("game_permission_denied", error.to_string()));
            }
            return Err(AppError::with_detail("userskins_create_failed", error.to_string()));
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

    pub fn extract_and_install(self, archive_name: &str) -> Result<InstallResult, AppError> {
        let payload = self.staging_dir.path().join("payload");
        std::fs::create_dir(&payload)?;
        let stats = archive::extract(&self.archive_path, archive_name, &payload, MAX_SKIN_BYTES)?;
        let (source, folder_name) = paths::select_skin_root(&payload, archive_name)?;
        let file_count = paths::count_files(&source)?;
        if file_count == 0 || !paths::contains_skin_definition(&source)? {
            return Err(AppError::new("archive_no_skin_definition"));
        }
        let size_bytes = paths::total_size(&source)?;
        let folder_name = paths::unique_folder_name(&self.userskins, &folder_name)?;
        let destination = self.userskins.join(&folder_name);
        std::fs::rename(&source, &destination)
            .map_err(|error| AppError::with_detail("skin_save_failed", error.to_string()))?;

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
    use super::{
        cleanup_orphans_with_threshold, is_orphan_staging_dir, register_active_staging,
        unregister_active_staging, InstallStaging, STAGING_PREFIX, STAGING_SUFFIX_LEN,
    };
    use std::fs;
    use std::time::Duration;

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

    #[test]
    fn prefix_matching_strictly_identifies_app_staging_dirs() {
        // Exactly prefix + 16 alphanumeric characters
        assert!(is_orphan_staging_dir(".wtcm-staging-1234567890abcdef"));
        assert!(is_orphan_staging_dir(".wtcm-staging-ABCDEFGHIJKLMNOP"));

        // Wrong suffix length
        assert!(!is_orphan_staging_dir(".wtcm-staging-abc123"));
        assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcdeftoolong"));
        assert!(!is_orphan_staging_dir(".wtcm-staging-"));

        // Invalid characters (e.g. symbols, underscores)
        assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcde_"));
        assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcde-"));

        // Unrelated folders
        assert!(!is_orphan_staging_dir("wtcm-my-skin"));
        assert!(!is_orphan_staging_dir("wtcm-12345"));
        assert!(!is_orphan_staging_dir("UserSkins"));
        assert!(!is_orphan_staging_dir("content"));
    }

    #[test]
    fn cleanup_orphans_respects_active_age_and_strict_naming() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let userskins = game_root.join("UserSkins");
        fs::create_dir_all(&userskins).unwrap();

        // 1. Unrelated folders
        let content_dir = game_root.join("content");
        fs::create_dir(&content_dir).unwrap();
        let my_skin_dir = userskins.join("MySkin");
        fs::create_dir(&my_skin_dir).unwrap();

        // 2. Skin folder named like "wtcm-my-skin" (in UserSkins and game_root)
        let wtcm_skin_in_userskins = userskins.join("wtcm-my-skin");
        fs::create_dir(&wtcm_skin_in_userskins).unwrap();
        let wtcm_dir_in_game_root = game_root.join("wtcm-my-skin");
        fs::create_dir(&wtcm_dir_in_game_root).unwrap();

        // 3. Staging dir matching strict format (.wtcm-staging-1234567890abcdef)
        let old_orphan = game_root.join(".wtcm-staging-1234567890abcdef");
        fs::create_dir(&old_orphan).unwrap();

        // 4. Fresh matching dir
        let fresh_staging = game_root.join(".wtcm-staging-abcdef1234567890");
        fs::create_dir(&fresh_staging).unwrap();

        // 5. Active registered staging dir
        let active_staging = game_root.join(".wtcm-staging-active1234567890");
        fs::create_dir(&active_staging).unwrap();
        register_active_staging(active_staging.clone());

        // First pass: with 10-minute threshold
        // - fresh_staging was just created, elapsed < 10m -> NOT deleted
        // - active_staging is registered -> NOT deleted
        // - old_orphan was just created, elapsed < 10m -> NOT deleted
        cleanup_orphans_with_threshold(&game_root, Duration::from_secs(600));
        assert!(fresh_staging.exists(), "fresh matching dir should not be deleted");
        assert!(active_staging.exists(), "active staging dir should not be deleted");
        assert!(old_orphan.exists(), "young dir should not be deleted with 10m threshold");

        // Second pass: with Duration::ZERO (simulating old age >= threshold)
        // - old_orphan is matching and not active -> DELETED
        // - active_staging is registered -> NOT deleted even with threshold 0
        // - wtcm-my-skin, content, UserSkins, MySkin -> NOT deleted
        cleanup_orphans_with_threshold(&game_root, Duration::ZERO);
        assert!(!old_orphan.exists(), "old matching dir should be deleted");
        assert!(active_staging.exists(), "active staging dir must stay even with 0 threshold");
        assert!(wtcm_skin_in_userskins.exists(), "wtcm-my-skin in UserSkins must stay");
        assert!(wtcm_dir_in_game_root.exists(), "wtcm-my-skin in game_root must stay");
        assert!(content_dir.exists(), "content dir must stay");
        assert!(userskins.exists(), "UserSkins dir must stay");
        assert!(my_skin_dir.exists(), "MySkin in UserSkins must stay");

        // Clean up active registry
        unregister_active_staging(&active_staging);
    }
}
