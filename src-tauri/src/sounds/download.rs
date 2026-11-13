use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::ipc::Channel;

use crate::skins::download_task::{DownloadControl, DownloadManager, SkinInstallProgress};
use crate::{providers::wt_live, skins::download, AppError};

use super::{library, types::SoundPackage};

const MAX_SOUND_ARCHIVE_BYTES: u64 = 2 * 1024 * 1024 * 1024;

pub async fn download_package(
    app_data_dir: &Path,
    lang_group: u64,
    title: String,
    author: String,
    task_id: &str,
    channel: Channel<SkinInstallProgress>,
    manager: &DownloadManager,
) -> Result<SoundPackage, AppError> {
    if lang_group == 0 {
        return Err(AppError::new("sound_post_id_invalid"));
    }
    let control = manager.register(task_id)?;
    control.begin_download();
    let result = async {
        let (id, partial_path, archive_path) = library::prepare_download(app_data_dir, lang_group)?;
        let source_name = match download_live_archive(lang_group, &partial_path, &control, &channel).await {
            Ok(name) => name,
            Err(error) => {
                let _ = fs::remove_dir_all(partial_path.parent().unwrap_or(&partial_path));
                return Err(error);
            }
        };
        let package_result = async {
            control.wait_until_resumed().await?;
            fs::rename(&partial_path, &archive_path).map_err(|error| {
                AppError::with_detail("sound_package_save_failed", error.to_string())
            })?;

            let archive_name = safe_archive_name(&source_name);
            let downloaded_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| AppError::new("sound_package_clock_error"))?
                .as_millis() as u64;
            let file_count_path = archive_path.clone();
            let file_count = tauri::async_runtime::spawn_blocking(move || {
                super::archive::archive_file_count(&file_count_path)
            })
            .await
            .ok()
            .and_then(Result::ok);
            control.wait_until_resumed().await?;
            let package = SoundPackage {
                id,
                lang_group,
                title: bounded_text(title, 200),
                author: bounded_text(author, 120),
                archive_name,
                size_bytes: fs::metadata(&archive_path)?.len(),
                downloaded_at,
                revision: 0,
                file_count,
            };
            library::publish_package(app_data_dir, &package)?;
            Ok(package)
        }
        .await;
        if package_result.is_err() {
            let _ = fs::remove_dir_all(partial_path.parent().unwrap_or(&partial_path));
        }
        package_result
    }
    .await;
    manager.finish(task_id);
    result
}

pub async fn update_package(
    app_data_dir: &Path,
    package_id: &str,
    expected_revision: u64,
    task_id: &str,
    channel: Channel<SkinInstallProgress>,
    manager: &DownloadManager,
) -> Result<SoundPackage, AppError> {
    let control = manager.register(task_id)?;
    control.begin_download();
    let result = async {
        control.wait_until_resumed().await?;
        let (current, stage_name, partial_path, archive_path) = super::package_update::prepare_update(
            app_data_dir, package_id, expected_revision, task_id,
        )?;
        let stage = archive_path.parent().ok_or_else(|| AppError::new("sound_package_update_stage_failed"))?;
        let update = async {
            let source_name = download_live_archive(current.lang_group, &partial_path, &control, &channel).await?;
            control.wait_until_resumed().await?;
            control.begin_extraction();
            control.check_cancelled()?;
            let _ = channel.send(SkinInstallProgress {
                phase: "extracting",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            });
            fs::rename(&partial_path, &archive_path).map_err(|error| {
                AppError::with_detail("sound_package_update_stage_failed", error.to_string())
            })?;
            let archive_for_validation = archive_path.clone();
            let validation_root = stage.to_path_buf();
            let file_count = tauri::async_runtime::spawn_blocking(move || {
                let count = super::archive::archive_file_count(&archive_for_validation)?;
                let validation = tempfile::tempdir_in(validation_root)?;
                super::archive::extract_banks(&archive_for_validation, validation.path())?;
                Ok::<usize, AppError>(count)
            })
            .await
            .map_err(|error| AppError::with_detail("sound_package_update_validation_failed", error.to_string()))??;
            if file_count == 0 {
                return Err(AppError::new("sound_archive_no_banks"));
            }
            control.check_cancelled()?;
            let downloaded_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| AppError::new("sound_package_clock_error"))?
                .as_millis() as u64;
            let package = SoundPackage {
                id: current.id.clone(),
                lang_group: current.lang_group,
                title: current.title,
                author: current.author,
                archive_name: safe_archive_name(&source_name),
                size_bytes: fs::metadata(&archive_path)?.len(),
                downloaded_at,
                revision: current.revision.checked_add(1)
                    .ok_or_else(|| AppError::new("sound_package_revision_unavailable"))?,
                file_count: Some(file_count),
            };
            control.check_cancelled()?;
            super::package_update::commit_update(app_data_dir, &package, expected_revision, &stage_name)
        }.await;
        if update.is_err() {
            super::package_update::discard_stage(app_data_dir, &stage_name);
        }
        update
    }
    .await;
    manager.finish(task_id);
    result
}

async fn download_live_archive(
    lang_group: u64,
    destination: &Path,
    control: &DownloadControl,
    channel: &Channel<SkinInstallProgress>,
) -> Result<String, AppError> {
    control.wait_until_resumed().await?;
    let (url, source_name) = wt_live::sound_download_source(lang_group).await?;
    control.wait_until_resumed().await?;
    download::download_archive(
        &url,
        destination,
        control,
        channel,
        MAX_SOUND_ARCHIVE_BYTES,
        Duration::from_secs(20 * 60),
        "sound_library_permission_denied",
    )
    .await?;
    Ok(source_name)
}

fn safe_archive_name(name: &str) -> String {
    let basename = Path::new(name)
        .file_name()
        .and_then(|part| part.to_str())
        .unwrap_or("sound-mod.zip");
    bounded_text(basename.to_owned(), 160)
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect()
}

fn bounded_text(value: String, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
}
