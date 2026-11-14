use std::fs;
use std::path::{Path, PathBuf};

use crate::AppError;

use super::{
    deployment::ensure_game_stopped,
    files::{copy_directory, directory_has_content, reject_symlink_or_non_directory},
    journal::{self, InstallState, StoragePaths},
    recovery,
    types::ExistingSoundModAction,
};

pub(super) fn replace_directory(
    app_data_dir: &Path,
    game_root: &Path,
    paths: &StoragePaths,
    target: &Path,
    stage: &Path,
    stage_name: &str,
    state: &mut InstallState,
    next_package: Option<(String, u64)>,
) -> Result<(), AppError> {
    ensure_game_stopped(game_root)?;
    let had_current = target.exists();
    if had_current {
        reject_symlink_or_non_directory(target)?;
    }
    let old_name = recovery::unique_name(".wtcm-sound-old-")?;
    if let Err(error) = recovery::write_transaction(
        paths,
        stage_name,
        &old_name,
        had_current,
        next_package.as_ref().map(|(id, _)| id.clone()),
        state.active_package_id.clone(),
        next_package.as_ref().map(|(_, revision)| *revision),
        state.active_package_revision,
    ) {
        let _ = fs::remove_dir_all(stage);
        return Err(error);
    }
    let sound_dir = target
        .parent()
        .ok_or_else(|| AppError::new("sound_game_path_invalid"))?;
    let old = sound_dir.join(&old_name);
    if had_current {
        if let Err(error) = fs::rename(target, &old) {
            let _ = recovery::recover_pending(app_data_dir, game_root);
            return Err(file_change_error("sound_deployment_failed", error));
        }
    }
    if let Some((package_id, revision)) = next_package {
        if let Err(error) = fs::rename(stage, target) {
            if had_current && fs::rename(&old, target).is_err() {
                return Err(AppError::with_detail(
                    "sound_recovery_required",
                    error.to_string(),
                ));
            }
            let _ = journal::clear_journal(paths);
            let _ = fs::remove_dir_all(stage);
            return Err(file_change_error("sound_deployment_failed", error));
        }
        state.active_package_id = Some(package_id);
        state.active_package_revision = Some(revision);
    } else {
        if stage.exists() {
            if let Err(error) = fs::rename(stage, target) {
                if had_current && fs::rename(&old, target).is_err() {
                    return Err(AppError::with_detail(
                        "sound_recovery_required",
                        error.to_string(),
                    ));
                }
                let _ = journal::clear_journal(paths);
                let _ = fs::remove_dir_all(stage);
                return Err(file_change_error("sound_deployment_failed", error));
            }
        }
        state.active_package_id = None;
        state.active_package_revision = None;
    }
    journal::write_state(paths, state)?;
    recovery::mark_committed(paths)?;
    if old.exists() {
        fs::remove_dir_all(&old)
            .map_err(|error| AppError::with_detail("sound_recovery_required", error.to_string()))?;
    }
    journal::clear_journal(paths)
}

pub(super) fn load_or_create_state(
    paths: &StoragePaths,
    game_root: &Path,
    target: &Path,
    existing_mod_action: Option<ExistingSoundModAction>,
) -> Result<InstallState, AppError> {
    if let Some(state) = journal::read_state(paths)? {
        if state.game_root != game_root.to_string_lossy() {
            return Err(AppError::new("sound_install_state_invalid"));
        }
        return Ok(state);
    }
    fs::create_dir_all(&paths.root)?;
    if paths.original_backup.exists() {
        return Err(AppError::new("sound_backup_conflict"));
    }
    let existing_content = target.is_dir() && directory_has_content(target)?;
    if existing_content && existing_mod_action.is_none() {
        return Err(AppError::new("sound_existing_mod_decision_required"));
    }
    let original_existed =
        existing_content && matches!(existing_mod_action, Some(ExistingSoundModAction::Backup));
    if original_existed {
        reject_symlink_or_non_directory(target)?;
        copy_directory(target, &paths.original_backup)?;
    }
    let state = InstallState {
        game_root: game_root.to_string_lossy().into_owned(),
        original_existed,
        active_package_id: None,
        active_package_revision: None,
    };
    journal::write_state(paths, &state)?;
    Ok(state)
}

fn file_change_error(code: &str, error: std::io::Error) -> AppError {
    if matches!(error.raw_os_error(), Some(32 | 33)) {
        AppError::with_detail("sound_file_locked", error.to_string())
    } else {
        AppError::with_detail(code, error.to_string())
    }
}

pub(super) struct StageCleanup(pub(super) PathBuf);

impl Drop for StageCleanup {
    fn drop(&mut self) {
        if self.0.exists() {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
