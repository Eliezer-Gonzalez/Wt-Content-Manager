use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::ipc::Channel;

use crate::skins::download_task::{DownloadManager, SkinInstallProgress};
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
    let (url, source_name) = wt_live::sound_download_source(lang_group).await?;
    let (id, partial_path, archive_path) = library::prepare_download(app_data_dir, lang_group)?;
    let control = manager.register(task_id)?;
    control.begin_download();
    let download_result = download::download_archive(
        &url,
        &partial_path,
        &control,
        &channel,
        MAX_SOUND_ARCHIVE_BYTES,
        Duration::from_secs(20 * 60),
        "sound_library_permission_denied",
    )
    .await;
    manager.finish(task_id);
    if let Err(error) = download_result {
        let _ = fs::remove_dir_all(partial_path.parent().unwrap_or(&partial_path));
        return Err(error);
    }
    control.check_cancelled()?;
    fs::rename(&partial_path, &archive_path)
        .map_err(|error| AppError::with_detail("sound_package_save_failed", error.to_string()))?;

    let archive_name = safe_archive_name(&source_name);
    let downloaded_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AppError::new("sound_package_clock_error"))?
        .as_millis() as u64;
    let package = SoundPackage {
        id,
        lang_group,
        title: bounded_text(title, 200),
        author: bounded_text(author, 120),
        archive_name,
        size_bytes: fs::metadata(&archive_path)?.len(),
        downloaded_at,
    };
    if let Err(error) = library::publish_package(app_data_dir, &package) {
        let _ = fs::remove_dir_all(archive_path.parent().unwrap_or(&archive_path));
        return Err(error);
    }
    Ok(package)
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
