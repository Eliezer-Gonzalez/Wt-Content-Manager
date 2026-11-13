use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppError;

use super::{
    game_process::{self, GameProcessStatus},
    journal::{self, InstallJournal},
};

pub fn recover_pending(app_data_dir: &Path, game_root: &Path) -> Result<bool, AppError> {
    let paths = journal::storage_paths(app_data_dir, game_root);
    let Some(journal_record) = journal::read_journal(&paths)? else {
        return Ok(false);
    };
    if game_process::status(game_root) != GameProcessStatus::Stopped {
        return Err(AppError::new("sound_game_must_be_closed"));
    }
    validate_name(&journal_record.stage_name, ".wtcm-sound-stage-")?;
    validate_name(&journal_record.old_name, ".wtcm-sound-old-")?;

    let sound_dir = game_root.join("sound");
    let target = sound_dir.join("mod");
    let stage = sound_dir.join(&journal_record.stage_name);
    let old = sound_dir.join(&journal_record.old_name);
    let committed = journal_record.committed;

    if committed {
        if old.exists() {
            fs::remove_dir_all(&old).map_err(|error| {
                AppError::with_detail("sound_recovery_required", error.to_string())
            })?;
        }
    } else if old.exists() {
        if target.exists() {
            let recovery = unique_recovery_path(&sound_dir)?;
            fs::rename(&target, recovery).map_err(|error| {
                AppError::with_detail("sound_recovery_required", error.to_string())
            })?;
        }
        fs::rename(&old, &target)
            .map_err(|error| AppError::with_detail("sound_recovery_required", error.to_string()))?;
    } else if journal_record.had_current && !target.exists() {
        return Err(AppError::new("sound_recovery_required"));
    } else if !journal_record.had_current && target.exists() {
        let recovery = unique_recovery_path(&sound_dir)?;
        fs::rename(&target, recovery)
            .map_err(|error| AppError::with_detail("sound_recovery_required", error.to_string()))?;
    }

    if !committed {
        if let Some(mut state) = journal::read_state(&paths)? {
            state.active_package_id = journal_record.previous_package_id;
            state.active_package_revision = journal_record.previous_package_revision;
            journal::write_state(&paths, &state)?;
        }
    }

    if stage.exists() {
        fs::remove_dir_all(stage)
            .map_err(|error| AppError::with_detail("sound_recovery_required", error.to_string()))?;
    }
    journal::clear_journal(&paths)?;
    Ok(true)
}

pub fn write_transaction(
    paths: &journal::StoragePaths,
    stage_name: &str,
    old_name: &str,
    had_current: bool,
    next_package_id: Option<String>,
    previous_package_id: Option<String>,
    next_package_revision: Option<u64>,
    previous_package_revision: Option<u64>,
) -> Result<(), AppError> {
    journal::write_journal(
        paths,
        &InstallJournal {
            stage_name: stage_name.to_owned(),
            old_name: old_name.to_owned(),
            had_current,
            next_package_id,
            previous_package_id,
            next_package_revision,
            previous_package_revision,
            committed: false,
        },
    )
}

pub fn mark_committed(paths: &journal::StoragePaths) -> Result<(), AppError> {
    let mut transaction = journal::read_journal(paths)?
        .ok_or_else(|| AppError::new("sound_recovery_journal_invalid"))?;
    transaction.committed = true;
    journal::write_journal(paths, &transaction)
}

pub fn unique_name(prefix: &str) -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AppError::new("sound_package_clock_error"))?
        .as_millis();
    Ok(format!("{prefix}{timestamp}"))
}

fn validate_name(value: &str, prefix: &str) -> Result<(), AppError> {
    if !value.starts_with(prefix)
        || value.len() <= prefix.len()
        || !value[prefix.len()..]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        || Path::new(value).components().count() != 1
    {
        return Err(AppError::new("sound_recovery_journal_invalid"));
    }
    Ok(())
}

fn unique_recovery_path(sound_dir: &Path) -> Result<PathBuf, AppError> {
    for _ in 0..1_000 {
        let name = unique_name(".wtcm-sound-recovery-")?;
        let path = sound_dir.join(name);
        if !path.exists() {
            return Ok(path);
        }
    }
    Err(AppError::new("sound_recovery_required"))
}
