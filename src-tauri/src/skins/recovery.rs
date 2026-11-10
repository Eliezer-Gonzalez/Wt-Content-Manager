use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use super::{
    is_orphan_staging_dir,
    library::validate_skin_folder_name,
    replacement::{ReplacementJournal, MAX_JOURNAL_BYTES, PREVIOUS_SKIN, REPLACEMENT_JOURNAL},
    staging::is_active_staging,
};

static GAME_FILESYSTEM_MUTATION_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn lock_game_filesystem() -> MutexGuard<'static, ()> {
    GAME_FILESYSTEM_MUTATION_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Default)]
pub(super) struct RecoverySummary {
    pub protected: Vec<ProtectedReplacement>,
}

pub(super) struct ProtectedReplacement {
    pub folder_name: Option<String>,
    pub staging_path: PathBuf,
}

pub(super) fn recover_pending_replacements(game_root: &Path) -> io::Result<RecoverySummary> {
    let root = fs::canonicalize(game_root)?;
    let userskins = game_root.join("UserSkins");
    let userskins_canon = match fs::canonicalize(&userskins) {
        Ok(path) => Some(path),
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => return Err(error),
    };
    if let Some(path) = &userskins_canon {
        let metadata = fs::symlink_metadata(&userskins)?;
        if metadata.file_type().is_symlink()
            || !metadata.is_dir()
            || path.parent() != Some(root.as_path())
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "UserSkins is not a direct directory under the game root",
            ));
        }
    }
    let mut summary = RecoverySummary::default();

    for entry in fs::read_dir(&root)? {
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_orphan_staging_dir(&name) {
            continue;
        }
        let staging_path = entry.path();
        if is_active_staging(&staging_path) {
            continue;
        }
        match entry.file_type() {
            Ok(kind) if kind.is_dir() && !kind.is_symlink() => {}
            _ => {
                summary.protected.push(ProtectedReplacement {
                    folder_name: None,
                    staging_path,
                });
                continue;
            }
        }
        let staging_canon = match fs::canonicalize(&staging_path) {
            Ok(path) if path.parent() == Some(root.as_path()) => path,
            _ => {
                summary.protected.push(ProtectedReplacement {
                    folder_name: None,
                    staging_path,
                });
                continue;
            }
        };
        let recovery = match &userskins_canon {
            Some(userskins) => recover_staging(&staging_canon, userskins),
            None if has_recovery_artifacts(&staging_canon) => Some(None),
            None => None,
        };
        if let Some(folder_name) = recovery {
            summary.protected.push(ProtectedReplacement {
                folder_name,
                staging_path: staging_canon,
            });
        }
    }

    Ok(summary)
}

/// Returns `Some(folder_name)` when this staging directory must be retained.
fn has_recovery_artifacts(staging: &Path) -> bool {
    for path in [
        staging.join(REPLACEMENT_JOURNAL),
        staging.join(PREVIOUS_SKIN),
    ] {
        match fs::symlink_metadata(path) {
            Ok(_) => return true,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(_) => return true,
        }
    }
    false
}

fn recover_staging(staging: &Path, userskins: &Path) -> Option<Option<String>> {
    let journal_path = staging.join(REPLACEMENT_JOURNAL);
    let backup = staging.join(PREVIOUS_SKIN);
    let journal_metadata = match fs::symlink_metadata(&journal_path) {
        Ok(metadata) => Some(metadata),
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(_) => return Some(None),
    };
    let backup_exists = match fs::symlink_metadata(&backup) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Some(None);
            }
            match fs::canonicalize(&backup) {
                Ok(path) if path.parent() == Some(staging) => {}
                _ => return Some(None),
            }
            true
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(_) => return Some(None),
    };

    let Some(metadata) = journal_metadata else {
        // Legacy backups without a journal cannot be safely associated with a UserSkins name.
        return backup_exists.then_some(None);
    };
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_JOURNAL_BYTES
    {
        return Some(None);
    }
    let journal_file = match fs::File::open(&journal_path) {
        Ok(file) => file,
        Err(_) => return Some(None),
    };
    let mut journal_bytes = Vec::with_capacity(MAX_JOURNAL_BYTES as usize);
    if journal_file
        .take(MAX_JOURNAL_BYTES + 1)
        .read_to_end(&mut journal_bytes)
        .is_err()
        || journal_bytes.len() as u64 > MAX_JOURNAL_BYTES
    {
        return Some(None);
    }
    let journal = match serde_json::from_slice::<ReplacementJournal>(&journal_bytes) {
        Ok(journal) if journal.supported() => journal,
        _ => return Some(None),
    };
    let folder_name = journal.folder_name().to_string();
    if validate_skin_folder_name(&folder_name).is_err() {
        return Some(None);
    }

    let target = userskins.join(&folder_name);
    let target_exists = match fs::symlink_metadata(&target) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Some(Some(folder_name));
            }
            match fs::canonicalize(&target) {
                Ok(path) if path.parent() == Some(userskins) => true,
                _ => return Some(Some(folder_name)),
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(_) => return Some(Some(folder_name)),
    };

    match (journal.is_committed(), backup_exists, target_exists) {
        (false, true, false) | (true, true, false) => {
            if fs::rename(&backup, &target).is_ok() {
                None
            } else {
                Some(Some(folder_name))
            }
        }
        (false, true, true) => Some(Some(folder_name)),
        (true, true, true) | (true, false, true) | (false, false, true) => None,
        (false, false, false) | (true, false, false) => Some(Some(folder_name)),
    }
}

#[cfg(test)]
#[path = "recovery/tests.rs"]
mod tests;
