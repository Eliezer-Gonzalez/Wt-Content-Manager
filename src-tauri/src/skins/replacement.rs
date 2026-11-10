use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};

use crate::AppError;

use super::library::validate_skin_folder_name;

pub(super) const REPLACEMENT_JOURNAL: &str = "replacement.json";
pub(super) const PREVIOUS_SKIN: &str = "previous-skin";
const JOURNAL_TEMP: &str = "replacement.json.tmp";
const JOURNAL_VERSION: u8 = 1;
pub(super) const MAX_JOURNAL_BYTES: u64 = 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum ReplacementJournal {
    Prepared { version: u8, folder_name: String },
    Committed { version: u8, folder_name: String },
}

impl ReplacementJournal {
    pub(super) fn folder_name(&self) -> &str {
        match self {
            Self::Prepared { folder_name, .. } | Self::Committed { folder_name, .. } => folder_name,
        }
    }

    pub(super) fn is_committed(&self) -> bool {
        matches!(self, Self::Committed { .. })
    }

    fn prepared(folder_name: &str) -> Self {
        Self::Prepared {
            version: JOURNAL_VERSION,
            folder_name: folder_name.to_string(),
        }
    }

    fn committed(folder_name: &str) -> Self {
        Self::Committed {
            version: JOURNAL_VERSION,
            folder_name: folder_name.to_string(),
        }
    }

    pub(super) fn supported(&self) -> bool {
        match self {
            Self::Prepared { version, .. } | Self::Committed { version, .. } => {
                *version == JOURNAL_VERSION
            }
        }
    }
}

#[derive(Debug)]
pub(super) struct ReplacementError {
    pub error: AppError,
    pub preserve_staging: bool,
}

impl ReplacementError {
    fn discardable(error: AppError) -> Self {
        Self {
            error,
            preserve_staging: false,
        }
    }

    fn preserve(error: AppError) -> Self {
        Self {
            error,
            preserve_staging: true,
        }
    }
}

pub(super) fn replace_skin_folder(
    userskins: &Path,
    folder_name: &str,
    replacement: &Path,
    staging_dir: &Path,
) -> Result<(), ReplacementError> {
    replace_skin_folder_with(
        userskins,
        folder_name,
        replacement,
        staging_dir,
        |from, to| fs::rename(from, to),
    )
}

fn replace_skin_folder_with<F>(
    userskins: &Path,
    folder_name: &str,
    replacement: &Path,
    staging_dir: &Path,
    mut rename: F,
) -> Result<(), ReplacementError>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    validate_skin_folder_name(folder_name).map_err(ReplacementError::discardable)?;
    let userskins_canon = fs::canonicalize(userskins)
        .map_err(|error| ReplacementError::discardable(AppError::from(error)))?;
    let staging_canon = fs::canonicalize(staging_dir)
        .map_err(|error| ReplacementError::discardable(AppError::from(error)))?;
    let staging_parent = staging_dir
        .parent()
        .and_then(|path| fs::canonicalize(path).ok());
    if staging_canon.parent() != staging_parent.as_deref()
        || userskins_canon.parent() != staging_canon.parent()
    {
        return Err(ReplacementError::discardable(AppError::new(
            "skin_invalid_folder",
        )));
    }

    let target = userskins_canon.join(folder_name);
    let backup = staging_canon.join(PREVIOUS_SKIN);
    let journal_path = staging_canon.join(REPLACEMENT_JOURNAL);
    for path in [&backup, &journal_path] {
        match fs::symlink_metadata(path) {
            Ok(_) => {
                return Err(ReplacementError::discardable(AppError::new(
                    "skin_invalid_folder",
                )))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(ReplacementError::discardable(AppError::from(error))),
        }
    }
    let target_metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(ReplacementError::discardable(AppError::new(
                "skin_not_found",
            )))
        }
        Err(error) => return Err(ReplacementError::discardable(AppError::from(error))),
    };
    if target_metadata.file_type().is_symlink() || !target_metadata.is_dir() {
        return Err(ReplacementError::discardable(AppError::new(
            "skin_invalid_folder",
        )));
    }
    let target_canon = fs::canonicalize(&target)
        .map_err(|error| ReplacementError::discardable(AppError::from(error)))?;
    let replacement_canon = fs::canonicalize(replacement)
        .map_err(|error| ReplacementError::discardable(AppError::from(error)))?;
    if target_canon.parent() != Some(userskins_canon.as_path())
        || !replacement_canon.starts_with(&staging_canon)
        || replacement_canon == staging_canon
    {
        return Err(ReplacementError::discardable(AppError::new(
            "skin_invalid_folder",
        )));
    }

    write_prepared_journal(&journal_path, folder_name).map_err(|error| {
        ReplacementError::discardable(AppError::with_detail("skin_save_failed", error.to_string()))
    })?;

    rename(&target, &backup).map_err(|error| {
        ReplacementError::discardable(AppError::with_detail("skin_save_failed", error.to_string()))
    })?;

    if let Err(error) = rename(&replacement_canon, &target) {
        return match rename(&backup, &target) {
            Ok(()) => {
                let _ = fs::remove_file(&journal_path);
                Err(ReplacementError::discardable(AppError::with_detail(
                    "skin_save_failed",
                    error.to_string(),
                )))
            }
            Err(restore_error) => Err(ReplacementError::preserve(AppError::with_detail(
                "skin_recovery_required",
                format!("{error}; restoring previous skin failed: {restore_error}"),
            ))),
        };
    }

    write_committed_journal(&journal_path, folder_name).map_err(|error| {
        ReplacementError::preserve(AppError::with_detail(
            "skin_recovery_required",
            format!(
                "replacement completed but its recovery record could not be committed: {error}"
            ),
        ))
    })
}

fn write_prepared_journal(path: &Path, folder_name: &str) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(&ReplacementJournal::prepared(folder_name))
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    if bytes.len() as u64 > MAX_JOURNAL_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "replacement journal exceeds its size limit",
        ));
    }
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(&bytes)?;
    file.sync_all()
}

fn write_committed_journal(path: &Path, folder_name: &str) -> std::io::Result<()> {
    let temp_path = path.with_file_name(JOURNAL_TEMP);
    let bytes = serde_json::to_vec(&ReplacementJournal::committed(folder_name))
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    fs::rename(temp_path, path)
}

#[cfg(test)]
#[path = "replacement/tests.rs"]
mod tests;
