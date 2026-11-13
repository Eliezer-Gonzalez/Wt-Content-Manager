use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::{skins::recovery::lock_game_filesystem, AppError};

use super::{library, types::SoundPackage};

const UPDATE_DIR: &str = "package-updates";
const JOURNAL_FILE: &str = "journal.json";
const COMMITTED_FILE: &str = "committed";
static CLEANED_STAGING_ROOTS: OnceLock<Mutex<std::collections::HashSet<PathBuf>>> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateJournal {
    package_id: String,
    expected_revision: u64,
    stage_name: String,
    backup_name: String,
}

pub fn prepare_update(
    app_data_dir: &Path,
    package_id: &str,
    expected_revision: u64,
    task_id: &str,
) -> Result<(SoundPackage, String, PathBuf, PathBuf), AppError> {
    validate_name(task_id, "")?;
    let _mutation = lock_game_filesystem();
    recover_pending_locked(app_data_dir)?;
    if read_journal(&update_root(app_data_dir))?.is_some() {
        return Err(AppError::new("sound_package_update_recovery_required"));
    }
    let package = library::read_package(app_data_dir, package_id)?;
    if package.revision != expected_revision {
        return Err(AppError::new("sound_package_update_stale"));
    }
    let stage_name = format!("stage-{task_id}");
    let stage = update_root(app_data_dir).join(&stage_name);
    fs::create_dir_all(update_root(app_data_dir))?;
    fs::create_dir(&stage).map_err(|error| {
        AppError::with_detail("sound_package_update_stage_failed", error.to_string())
    })?;
    Ok((
        package,
        stage_name,
        stage.join("source.part"),
        stage.join("source.zip"),
    ))
}

pub fn commit_update(
    app_data_dir: &Path,
    package: &SoundPackage,
    expected_revision: u64,
    stage_name: &str,
) -> Result<SoundPackage, AppError> {
    let _mutation = lock_game_filesystem();
    recover_pending_locked(app_data_dir)?;
    if read_journal(&update_root(app_data_dir))?.is_some() {
        return Err(AppError::new("sound_package_update_recovery_required"));
    }
    validate_name(stage_name, "stage-")?;
    if package.revision
        != expected_revision
            .checked_add(1)
            .ok_or_else(|| AppError::new("sound_package_revision_unavailable"))?
    {
        return Err(AppError::new("sound_package_update_stale"));
    }
    let current = library::read_package(app_data_dir, &package.id)?;
    if current.revision != expected_revision || current.lang_group != package.lang_group {
        return Err(AppError::new("sound_package_update_stale"));
    }

    let root = update_root(app_data_dir);
    let stage = root.join(stage_name);
    if !stage.join("source.zip").is_file() {
        return Err(AppError::new("sound_package_archive_missing"));
    }
    library::write_package_manifest(&stage, package)?;
    let backup_name = format!("backup-{}", stage_name.trim_start_matches("stage-"));
    let backup = root.join(&backup_name);
    if backup.exists() {
        return Err(AppError::new("sound_package_update_recovery_required"));
    }
    let journal = UpdateJournal {
        package_id: package.id.clone(),
        expected_revision,
        stage_name: stage_name.to_owned(),
        backup_name: backup_name.clone(),
    };
    write_journal(&root, &journal)?;

    let target = library::package_path(app_data_dir, &package.id)?;
    fs::rename(&target, &backup)
        .map_err(|error| AppError::with_detail("sound_package_update_failed", error.to_string()))?;
    if let Err(error) = fs::rename(&stage, &target) {
        if recover_pending_locked(app_data_dir).is_err() {
            return Err(AppError::with_detail(
                "sound_package_update_recovery_required",
                error.to_string(),
            ));
        }
        return Err(AppError::with_detail(
            "sound_package_update_failed",
            error.to_string(),
        ));
    }
    if let Err(error) = fs::write(root.join(COMMITTED_FILE), b"committed") {
        let _ = recover_pending_locked(app_data_dir);
        return Err(AppError::with_detail(
            "sound_package_update_recovery_required",
            error.to_string(),
        ));
    }

    if fs::remove_dir_all(&backup).is_ok() {
        let _ = clear_journal(&root);
    }
    Ok(package.clone())
}

pub fn discard_stage(app_data_dir: &Path, stage_name: &str) {
    let _mutation = lock_game_filesystem();
    let Ok(()) = recover_pending_locked(app_data_dir) else {
        return;
    };
    if validate_name(stage_name, "stage-").is_err() {
        return;
    }
    let root = update_root(app_data_dir);
    let Ok(journal) = read_journal(&root) else {
        return;
    };
    if journal
        .as_ref()
        .is_some_and(|record| record.stage_name == stage_name)
    {
        return;
    }
    let _ = fs::remove_dir_all(root.join(stage_name));
}

pub(super) fn recover_pending_locked(app_data_dir: &Path) -> Result<(), AppError> {
    let root = update_root(app_data_dir);
    let Some(journal) = read_journal(&root)? else {
        cleanup_orphaned_stages_once(&root)?;
        return Ok(());
    };
    validate_name(&journal.package_id, "")?;
    validate_name(&journal.stage_name, "stage-")?;
    validate_name(&journal.backup_name, "backup-")?;
    let target = library::package_path(app_data_dir, &journal.package_id)?;
    let stage = root.join(&journal.stage_name);
    let backup = root.join(&journal.backup_name);
    let committed = root.join(COMMITTED_FILE).is_file();

    if committed {
        let updated_is_valid = target.is_dir()
            && library::read_package(app_data_dir, &journal.package_id).is_ok_and(|package| {
                package.revision == journal.expected_revision.saturating_add(1)
            });
        if !updated_is_valid {
            if !backup.exists() {
                return Err(AppError::new("sound_package_update_recovery_required"));
            }
            if target.exists() {
                fs::remove_dir_all(&target).map_err(|error| {
                    AppError::with_detail(
                        "sound_package_update_recovery_required",
                        error.to_string(),
                    )
                })?;
            }
            fs::rename(&backup, &target).map_err(|error| {
                AppError::with_detail("sound_package_update_recovery_required", error.to_string())
            })?;
            let _ = fs::remove_file(root.join(COMMITTED_FILE));
        } else if backup.exists() && fs::remove_dir_all(&backup).is_err() {
            return Ok(());
        }
    } else if backup.exists() {
        if target.exists() {
            fs::remove_dir_all(&target).map_err(|error| {
                AppError::with_detail("sound_package_update_recovery_required", error.to_string())
            })?;
        }
        fs::rename(&backup, &target).map_err(|error| {
            AppError::with_detail("sound_package_update_recovery_required", error.to_string())
        })?;
    }

    if stage.exists() {
        let _ = fs::remove_dir_all(stage);
    }
    if !backup.exists() {
        clear_journal(&root)?;
    }
    cleanup_orphaned_stages_once(&root)?;
    Ok(())
}

fn cleanup_orphaned_stages_once(root: &Path) -> Result<(), AppError> {
    let cleaned_roots =
        CLEANED_STAGING_ROOTS.get_or_init(|| Mutex::new(std::collections::HashSet::new()));
    let mut cleaned = cleaned_roots
        .lock()
        .map_err(|_| AppError::new("sound_package_update_recovery_required"))?;
    if cleaned.contains(root) {
        return Ok(());
    }
    if !root.is_dir() {
        cleaned.insert(root.to_path_buf());
        return Ok(());
    }
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if entry.file_type()?.is_dir() && name.starts_with("stage-") {
            fs::remove_dir_all(entry.path()).map_err(|error| {
                AppError::with_detail("sound_package_update_recovery_required", error.to_string())
            })?;
        } else if entry.file_type()?.is_file() && name == "journal.tmp" {
            fs::remove_file(entry.path()).map_err(|error| {
                AppError::with_detail("sound_package_update_recovery_required", error.to_string())
            })?;
        }
    }
    cleaned.insert(root.to_path_buf());
    Ok(())
}

fn update_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("sounds").join(UPDATE_DIR)
}

fn write_journal(root: &Path, journal: &UpdateJournal) -> Result<(), AppError> {
    if root.join(JOURNAL_FILE).exists() {
        return Err(AppError::new("sound_package_update_recovery_required"));
    }
    let bytes = serde_json::to_vec_pretty(journal).map_err(|error| {
        AppError::with_detail("sound_package_update_journal_failed", error.to_string())
    })?;
    fs::create_dir_all(root)?;
    fs::write(root.join("journal.tmp"), bytes)?;
    fs::rename(root.join("journal.tmp"), root.join(JOURNAL_FILE)).map_err(|error| {
        AppError::with_detail("sound_package_update_journal_failed", error.to_string())
    })
}

fn read_journal(root: &Path) -> Result<Option<UpdateJournal>, AppError> {
    let path = root.join(JOURNAL_FILE);
    if !path.is_file() {
        return Ok(None);
    }
    serde_json::from_slice(&fs::read(path)?)
        .map(Some)
        .map_err(|error| {
            AppError::with_detail("sound_package_update_journal_invalid", error.to_string())
        })
}

fn clear_journal(root: &Path) -> Result<(), AppError> {
    let marker = root.join(COMMITTED_FILE);
    if marker.exists() {
        fs::remove_file(marker)?
    }
    let journal = root.join(JOURNAL_FILE);
    if journal.exists() {
        fs::remove_file(journal)?
    }
    Ok(())
}

fn validate_name(value: &str, prefix: &str) -> Result<(), AppError> {
    if !value.starts_with(prefix)
        || value.len() <= prefix.len()
        || !value[prefix.len()..]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        || Path::new(value).components().count() != 1
    {
        return Err(AppError::new("sound_package_update_journal_invalid"));
    }
    Ok(())
}

#[cfg(test)]
#[path = "package_update/tests.rs"]
mod tests;
