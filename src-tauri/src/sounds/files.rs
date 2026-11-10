use std::fs;
use std::path::{Path, PathBuf};

use crate::AppError;

pub fn ensure_sound_directory(game_root: &Path) -> Result<(), AppError> {
    let sound_dir = game_root.join("sound");
    if sound_dir.exists() {
        reject_symlink_or_non_directory(&sound_dir)?;
    } else {
        fs::create_dir(&sound_dir).map_err(|error| {
            AppError::with_detail("sound_folder_create_failed", error.to_string())
        })?;
    }
    Ok(())
}

pub fn sound_mod_path(game_root: &Path) -> Result<PathBuf, AppError> {
    let sound_dir = game_root.join("sound");
    if sound_dir.exists() {
        reject_symlink_or_non_directory(&sound_dir)?;
    }
    let target = sound_dir.join("mod");
    if target.exists() {
        reject_symlink_or_non_directory(&target)?;
    }
    Ok(target)
}

pub fn reject_symlink_or_non_directory(path: &Path) -> Result<(), AppError> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(AppError::new("sound_deployment_path_invalid"));
    }
    Ok(())
}

pub fn copy_directory(source: &Path, destination: &Path) -> Result<(), AppError> {
    reject_symlink_or_non_directory(source)?;
    fs::create_dir(destination)
        .map_err(|error| AppError::with_detail("sound_backup_failed", error.to_string()))?;
    let result = (|| {
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            let source_path = entry.path();
            let destination_path = destination.join(entry.file_name());
            let metadata = fs::symlink_metadata(&source_path)?;
            if metadata.file_type().is_symlink() {
                return Err(AppError::new("sound_backup_link_rejected"));
            }
            if metadata.is_dir() {
                copy_directory(&source_path, &destination_path)?;
            } else if metadata.is_file() {
                fs::copy(source_path, destination_path).map_err(|error| {
                    AppError::with_detail("sound_backup_failed", error.to_string())
                })?;
            } else {
                return Err(AppError::new("sound_backup_entry_rejected"));
            }
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(destination);
    }
    result
}

pub fn count_banks(root: &Path) -> Result<usize, AppError> {
    let mut count = 0;
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            count += count_banks(&entry.path())?;
        } else if entry
            .path()
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("bank"))
        {
            count += 1;
        }
    }
    Ok(count)
}
