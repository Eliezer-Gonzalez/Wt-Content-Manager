use std::fs;
use std::path::{Path, PathBuf};

use crate::{game_install, skins::recovery::lock_game_filesystem, AppError};

use super::{
    archive,
    files::{copy_directory, count_banks, ensure_sound_directory, sound_mod_path},
    game_process::{self, GameProcessStatus},
    journal, library, recovery,
    types::{ExistingSoundModAction, SoundInstallResult, SoundModStatus},
};

#[path = "deployment/preflight.rs"]
mod preflight;
#[cfg(test)]
#[path = "deployment/tests.rs"]
mod tests;

pub use preflight::install_preflight;
pub(super) use super::deployment_fs::{load_or_create_state, replace_directory, StageCleanup};

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
    let package = library::read_package(app_data_dir, package_id)?;
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
        Some((package_id.to_owned(), package.revision)),
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
        active_package_id: state.as_ref().and_then(|state| state.active_package_id.clone()),
        active_package_revision: state.and_then(|state| state.active_package_revision),
    })
}

fn validated_game_root(game_path: &str) -> Result<PathBuf, AppError> {
    game_install::validate(game_path)?;
    fs::canonicalize(game_path)
        .map_err(|error| AppError::with_detail("game_folder_not_found", error.to_string()))
}

pub(super) fn ensure_game_stopped(game_root: &Path) -> Result<(), AppError> {
    match game_process::status(game_root) {
        GameProcessStatus::Stopped => Ok(()),
        GameProcessStatus::Running => Err(AppError::new("sound_game_must_be_closed")),
        GameProcessStatus::Unknown => Err(AppError::new("sound_game_status_unknown")),
    }
}
