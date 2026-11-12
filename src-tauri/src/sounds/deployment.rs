use std::fs;
use std::path::{Path, PathBuf};

use crate::{game_install, skins::recovery::lock_game_filesystem, AppError};

use super::{
    archive,
    files::{
        copy_directory, count_banks, directory_has_content, ensure_sound_directory,
        reject_symlink_or_non_directory, sound_mod_path,
    },
    game_process::{self, GameProcessStatus},
    journal::{self, InstallState},
    library, recovery,
    types::{ExistingSoundModAction, SoundInstallResult, SoundModStatus},
};

#[path = "deployment/preflight.rs"]
mod preflight;
#[cfg(test)]
#[path = "deployment/tests.rs"]
mod tests;

pub use preflight::install_preflight;

pub fn install(
    app_data_dir: &Path,
    game_path: &str,
    package_id: &str,
    existing_mod_action: Option<ExistingSoundModAction>,
) -> Result<SoundInstallResult, AppError> {
    let game_root = validated_game_root(game_path)?;
    let _mutation = lock_game_filesystem();
    ensure_game_stopped(&game_root)?;
    recovery::recover_pending(app_data_dir, &game_root)?;
    ensure_sound_directory(&game_root)?;
    let target = sound_mod_path(&game_root)?;
    let paths = journal::storage_paths(app_data_dir, &game_root);
    let archive = library::package_archive(app_data_dir, package_id)?;
    let sound_dir = target
        .parent()
        .ok_or_else(|| AppError::new("sound_game_path_invalid"))?;
    let stage_name = recovery::unique_name(".wtcm-sound-stage-")?;
    let stage = sound_dir.join(&stage_name);
    fs::create_dir(&stage)
        .map_err(|error| AppError::with_detail("sound_stage_create_failed", error.to_string()))?;
    let _stage_cleanup = StageCleanup(stage.clone());
    let inventory = match archive::extract_banks(&archive, &stage) {
        Ok(inventory) => inventory,
        Err(error) => {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
    };
    ensure_game_stopped(&game_root)?;
    let mut state = match load_or_create_state(&paths, &game_root, &target, existing_mod_action) {
        Ok(state) => state,
        Err(error) => {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
    };
    replace_directory(
        app_data_dir,
        &game_root,
        &paths,
        &target,
        &stage,
        &stage_name,
        &mut state,
        Some(package_id.to_owned()),
    )?;
    Ok(SoundInstallResult {
        package_id: package_id.to_owned(),
        installed_banks: inventory.count,
        backup_created: state.original_existed,
    })
}

pub fn restore(app_data_dir: &Path, game_path: &str) -> Result<(), AppError> {
    let game_root = validated_game_root(game_path)?;
    let _mutation = lock_game_filesystem();
    ensure_game_stopped(&game_root)?;
    recovery::recover_pending(app_data_dir, &game_root)?;
    ensure_sound_directory(&game_root)?;
    let target = sound_mod_path(&game_root)?;
    let paths = journal::storage_paths(app_data_dir, &game_root);
    let mut state =
        journal::read_state(&paths)?.ok_or_else(|| AppError::new("sound_backup_missing"))?;
    if state.game_root != game_root.to_string_lossy() {
        return Err(AppError::new("sound_install_state_invalid"));
    }
    let sound_dir = target
        .parent()
        .ok_or_else(|| AppError::new("sound_game_path_invalid"))?;
    let stage_name = recovery::unique_name(".wtcm-sound-stage-")?;
    let stage = sound_dir.join(&stage_name);
    if state.original_existed {
        if !paths.original_backup.is_dir() {
            return Err(AppError::new("sound_backup_missing"));
        }
        copy_directory(&paths.original_backup, &stage)?;
    }
    let _stage_cleanup = StageCleanup(stage.clone());
    if let Err(error) = ensure_game_stopped(&game_root) {
        if stage.exists() {
            let _ = fs::remove_dir_all(&stage);
        }
        return Err(error);
    }
    replace_directory(
        app_data_dir,
        &game_root,
        &paths,
        &target,
        &stage,
        &stage_name,
        &mut state,
        None,
    )
}

pub fn uninstall(app_data_dir: &Path, game_path: &str) -> Result<(), AppError> {
    let game_root = validated_game_root(game_path)?;
    let _mutation = lock_game_filesystem();
    ensure_game_stopped(&game_root)?;
    recovery::recover_pending(app_data_dir, &game_root)?;
    ensure_sound_directory(&game_root)?;
    let target = sound_mod_path(&game_root)?;
    let paths = journal::storage_paths(app_data_dir, &game_root);
    let mut state =
        journal::read_state(&paths)?.ok_or_else(|| AppError::new("sound_install_state_invalid"))?;
    if state.game_root != game_root.to_string_lossy() || state.active_package_id.is_none() {
        return Err(AppError::new("sound_install_state_invalid"));
    }
    let sound_dir = target
        .parent()
        .ok_or_else(|| AppError::new("sound_game_path_invalid"))?;
    let stage_name = recovery::unique_name(".wtcm-sound-stage-")?;
    let stage = sound_dir.join(&stage_name);
    fs::create_dir(&stage)
        .map_err(|error| AppError::with_detail("sound_stage_create_failed", error.to_string()))?;
    let _stage_cleanup = StageCleanup(stage.clone());
    ensure_game_stopped(&game_root)?;
    replace_directory(
        app_data_dir,
        &game_root,
        &paths,
        &target,
        &stage,
        &stage_name,
        &mut state,
        None,
    )
}

pub fn status(app_data_dir: &Path, game_path: &str) -> Result<SoundModStatus, AppError> {
    let game_root = validated_game_root(game_path)?;
    let _mutation = lock_game_filesystem();
    let target = sound_mod_path(&game_root)?;
    let paths = journal::storage_paths(app_data_dir, &game_root);
    if journal::read_journal(&paths)?.is_some() {
        if game_process::status(&game_root) != GameProcessStatus::Stopped {
            return Err(AppError::new("sound_game_must_be_closed"));
        }
        recovery::recover_pending(app_data_dir, &game_root)?;
    }
    let state = journal::read_state(&paths)?;
    let process_status = game_process::status(&game_root);
    let installed_banks = if target.is_dir() {
        count_banks(&target)?
    } else {
        0
    };
    Ok(SoundModStatus {
        game_running: process_status != GameProcessStatus::Stopped,
        process_status: match process_status {
            GameProcessStatus::Running => "running",
            GameProcessStatus::Stopped => "stopped",
            GameProcessStatus::Unknown => "unknown",
        }
        .to_owned(),
        installed_banks,
        backup_available: state.is_some(),
        original_backup_available: state.as_ref().is_some_and(|state| state.original_existed),
        active_package_id: state.and_then(|state| state.active_package_id),
    })
}

fn replace_directory(
    app_data_dir: &Path,
    game_root: &Path,
    paths: &journal::StoragePaths,
    target: &Path,
    stage: &Path,
    stage_name: &str,
    state: &mut InstallState,
    next_package_id: Option<String>,
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
        next_package_id.clone(),
        state.active_package_id.clone(),
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
    if let Some(package_id) = next_package_id {
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
    }
    journal::write_state(paths, state)?;
    recovery::mark_committed(paths)?;
    if old.exists() {
        fs::remove_dir_all(&old)
            .map_err(|error| AppError::with_detail("sound_recovery_required", error.to_string()))?;
    }
    journal::clear_journal(paths)
}

fn load_or_create_state(
    paths: &journal::StoragePaths,
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
    };
    journal::write_state(paths, &state)?;
    Ok(state)
}

fn validated_game_root(game_path: &str) -> Result<PathBuf, AppError> {
    game_install::validate(game_path)?;
    fs::canonicalize(game_path)
        .map_err(|error| AppError::with_detail("game_folder_not_found", error.to_string()))
}

fn ensure_game_stopped(game_root: &Path) -> Result<(), AppError> {
    match game_process::status(game_root) {
        GameProcessStatus::Stopped => Ok(()),
        GameProcessStatus::Running => Err(AppError::new("sound_game_must_be_closed")),
        GameProcessStatus::Unknown => Err(AppError::new("sound_game_status_unknown")),
    }
}

fn file_change_error(code: &str, error: std::io::Error) -> AppError {
    if matches!(error.raw_os_error(), Some(32 | 33)) {
        AppError::with_detail("sound_file_locked", error.to_string())
    } else {
        AppError::with_detail(code, error.to_string())
    }
}

struct StageCleanup(PathBuf);

impl Drop for StageCleanup {
    fn drop(&mut self) {
        if self.0.exists() {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
