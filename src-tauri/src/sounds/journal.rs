use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallState {
    pub game_root: String,
    pub original_existed: bool,
    pub active_package_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallJournal {
    pub stage_name: String,
    pub old_name: String,
    pub had_current: bool,
    pub next_package_id: Option<String>,
    pub previous_package_id: Option<String>,
    pub committed: bool,
}

pub struct StoragePaths {
    pub root: PathBuf,
    pub state: PathBuf,
    pub journal: PathBuf,
    pub original_backup: PathBuf,
}

pub fn storage_paths(app_data_dir: &Path, game_root: &Path) -> StoragePaths {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in game_root.to_string_lossy().to_lowercase().bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    let root = app_data_dir
        .join("sounds")
        .join("installations")
        .join(format!("{hash:016x}"));
    StoragePaths {
        state: root.join("state.json"),
        journal: root.join("journal.json"),
        original_backup: root.join("original"),
        root,
    }
}

pub fn read_state(paths: &StoragePaths) -> Result<Option<InstallState>, AppError> {
    if !paths.state.is_file() {
        return Ok(None);
    }
    serde_json::from_slice(&std::fs::read(&paths.state)?)
        .map(Some)
        .map_err(|error| AppError::with_detail("sound_install_state_invalid", error.to_string()))
}

pub fn write_state(paths: &StoragePaths, state: &InstallState) -> Result<(), AppError> {
    write_json(&paths.state, state, "sound_install_state_write_failed")
}

pub fn read_journal(paths: &StoragePaths) -> Result<Option<InstallJournal>, AppError> {
    if !paths.journal.is_file() {
        return Ok(None);
    }
    serde_json::from_slice(&std::fs::read(&paths.journal)?)
        .map(Some)
        .map_err(|error| AppError::with_detail("sound_recovery_journal_invalid", error.to_string()))
}

pub fn write_journal(paths: &StoragePaths, journal: &InstallJournal) -> Result<(), AppError> {
    write_json(
        &paths.journal,
        journal,
        "sound_recovery_journal_write_failed",
    )
}

pub fn clear_journal(paths: &StoragePaths) -> Result<(), AppError> {
    if paths.journal.exists() {
        std::fs::remove_file(&paths.journal)?;
    }
    Ok(())
}

fn write_json<T: Serialize>(path: &Path, value: &T, code: &str) -> Result<(), AppError> {
    let encoded = serde_json::to_vec_pretty(value)
        .map_err(|error| AppError::with_detail(code, error.to_string()))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::create_dir_all(path.parent().ok_or_else(|| AppError::new(code))?)?;
    std::fs::write(&temporary, encoded)
        .map_err(|error| AppError::with_detail(code, error.to_string()))?;
    std::fs::rename(&temporary, path)
        .map_err(|error| AppError::with_detail(code, error.to_string()))
}
