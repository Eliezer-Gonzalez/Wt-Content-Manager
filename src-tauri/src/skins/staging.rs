use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use super::recovery::{lock_game_filesystem, recover_pending_replacements, ProtectedReplacement};

#[derive(Debug, Clone, Copy, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TemporaryFileReport {
    pub directory_count: usize,
    pub total_bytes: u64,
    pub recovery_required_count: usize,
}

#[derive(Debug, Clone, Copy, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TemporaryCleanupOutcome {
    pub removed_directories: usize,
    pub freed_bytes: u64,
    pub failed_directories: usize,
    pub recovery_required_count: usize,
}

pub const STAGING_PREFIX: &str = ".wtcm-staging-";
pub const STAGING_SUFFIX_LEN: usize = 16;
pub const DEFAULT_ORPHAN_AGE_THRESHOLD: std::time::Duration =
    std::time::Duration::from_secs(10 * 60);

static ACTIVE_STAGING_DIRS: std::sync::Mutex<Option<std::collections::HashSet<PathBuf>>> =
    std::sync::Mutex::new(None);

fn normalized_staging_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

pub fn register_active_staging(path: PathBuf) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        lock.get_or_insert_with(std::collections::HashSet::new)
            .insert(normalized_staging_path(&path));
    }
}

pub fn unregister_active_staging(path: &Path) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_mut() {
            set.remove(&normalized_staging_path(path));
            set.remove(path);
        }
    }
}

pub fn is_active_staging(path: &Path) -> bool {
    if let Ok(lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_ref() {
            return set.contains(&normalized_staging_path(path));
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

pub(super) fn cleanup_orphans_locked(game_root: &Path, age_threshold: std::time::Duration) {
    let _ = cleanup_orphan_staging_locked(game_root, age_threshold);
}

pub fn inspect_orphan_staging(game_root: &Path) -> io::Result<TemporaryFileReport> {
    inspect_orphan_staging_with_threshold(game_root, DEFAULT_ORPHAN_AGE_THRESHOLD)
}

pub fn inspect_orphan_staging_with_threshold(
    game_root: &Path,
    age_threshold: std::time::Duration,
) -> io::Result<TemporaryFileReport> {
    let _mutation = lock_game_filesystem();
    let recovery = recover_pending_replacements(game_root)?;
    let directories = eligible_orphan_staging_dirs(game_root, age_threshold, &recovery.protected)?;
    let mut report = TemporaryFileReport::default();
    report.recovery_required_count = recovery.protected.len();
    for directory in directories {
        report.total_bytes = report
            .total_bytes
            .saturating_add(directory_size(&directory)?);
        report.directory_count += 1;
    }
    Ok(report)
}

pub fn cleanup_orphan_staging(game_root: &Path) -> io::Result<TemporaryCleanupOutcome> {
    cleanup_orphan_staging_with_threshold(game_root, DEFAULT_ORPHAN_AGE_THRESHOLD)
}

pub fn cleanup_orphan_staging_with_threshold(
    game_root: &Path,
    age_threshold: std::time::Duration,
) -> io::Result<TemporaryCleanupOutcome> {
    let _mutation = lock_game_filesystem();
    cleanup_orphan_staging_locked(game_root, age_threshold)
}

fn cleanup_orphan_staging_locked(
    game_root: &Path,
    age_threshold: std::time::Duration,
) -> io::Result<TemporaryCleanupOutcome> {
    let recovery = recover_pending_replacements(game_root)?;
    let directories = eligible_orphan_staging_dirs(game_root, age_threshold, &recovery.protected)?;
    let mut outcome = TemporaryCleanupOutcome::default();
    outcome.recovery_required_count = recovery.protected.len();
    for directory in directories {
        let Ok(bytes) = directory_size(&directory) else {
            outcome.failed_directories += 1;
            continue;
        };
        match fs::remove_dir_all(&directory) {
            Ok(()) => {
                outcome.removed_directories += 1;
                outcome.freed_bytes = outcome.freed_bytes.saturating_add(bytes);
            }
            Err(_) => outcome.failed_directories += 1,
        }
    }
    Ok(outcome)
}

fn eligible_orphan_staging_dirs(
    game_root: &Path,
    age_threshold: std::time::Duration,
    protected: &[ProtectedReplacement],
) -> io::Result<Vec<PathBuf>> {
    let root = std::fs::canonicalize(game_root)?;
    let entries = std::fs::read_dir(&root)?;
    let mut directories = Vec::new();
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
        if protected
            .iter()
            .any(|entry| entry.staging_path == entry_path)
        {
            continue;
        }

        let Ok(modified) = entry.metadata().and_then(|metadata| metadata.modified()) else {
            continue;
        };
        let Ok(elapsed) = modified.elapsed() else {
            continue;
        };
        if elapsed < age_threshold {
            continue;
        }
        directories.push(entry_path);
    }
    Ok(directories)
}

fn directory_size(root: &Path) -> io::Result<u64> {
    let mut pending = vec![root.to_path_buf()];
    let mut total = 0_u64;
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            let kind = entry.file_type()?;
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() {
                total = total.saturating_add(entry.metadata()?.len());
            }
        }
    }
    Ok(total)
}

#[cfg(test)]
#[path = "staging/tests.rs"]
mod tests;
