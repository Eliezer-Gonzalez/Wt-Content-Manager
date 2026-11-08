// UnRAR source code may be used in any software to handle
// RAR archives without limitations free of charge, but cannot be
// used to develop RAR (WinRAR) compatible archiver and to
// re-create RAR compression algorithm, which is proprietary.
// Distribution of modified UnRAR source code in separate form or as a part
// of other software is permitted, provided that full text of this paragraph
// from “UnRAR source code” is included in the license or documentation and
// in source code comments of the resulting package.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::path::Path;
use unrar_rs::{Limits, RarArchive};

use super::ExtractStats;
use crate::skins::paths::{
    check_archive_entry_allowed, safe_archive_path, ArchiveEntryFilter, MAX_ARCHIVE_ENTRIES,
    MAX_ENTRY_BYTES,
};
use crate::AppError;

pub fn extract(
    archive_path: &Path,
    destination: &Path,
    size_limit: u64,
) -> Result<ExtractStats, AppError> {
    let file = fs::File::open(archive_path)?;
    let mut archive = RarArchive::open(file)
        .map_err(|error| AppError::with_detail("archive_open_failed", error.to_string()))?;
    archive.set_limits(Limits {
        max_data_segment: MAX_ENTRY_BYTES,
        max_unpacked_size: MAX_ENTRY_BYTES,
        ..Limits::default()
    });
    if archive.is_empty() {
        return Err(AppError::new("archive_empty_or_too_many_entries"));
    }

    let members = archive.entries().collect::<Vec<_>>();
    let mut total_declared = 0_u64;
    let mut paths = Vec::with_capacity(members.len());
    let mut written_paths = HashSet::new();
    let mut stats = ExtractStats::default();

    for member in &members {
        if member.is_symlink || member.is_hardlink || member.is_file_copy {
            return Err(AppError::new("archive_symlink_rejected"));
        }
        let relative = safe_archive_path(&member.name)?;
        if !member.is_directory {
            match check_archive_entry_allowed(&relative) {
                ArchiveEntryFilter::Allowed => {
                    let size = member
                        .unpacked_size
                        .ok_or_else(|| AppError::new("archive_missing_size"))?;
                    total_declared = total_declared
                        .checked_add(size)
                        .ok_or_else(|| AppError::new("archive_size_overflow"))?;
                    if size > MAX_ENTRY_BYTES || total_declared > size_limit {
                        return Err(AppError::new("archive_limits_exceeded"));
                    }
                    if !written_paths.insert(relative.clone()) {
                        return Err(AppError::new("archive_duplicate_paths"));
                    }
                    stats.extracted_files += 1;
                    if stats.extracted_files > MAX_ARCHIVE_ENTRIES {
                        return Err(AppError::new("archive_limits_exceeded"));
                    }
                    paths.push((Some(relative), false));
                }
                ArchiveEntryFilter::DisallowedExecutable => {
                    stats.skipped_files += 1;
                    stats.skipped_executables += 1;
                    paths.push((None, false));
                }
                ArchiveEntryFilter::DisallowedOther => {
                    stats.skipped_files += 1;
                    paths.push((None, false));
                }
            }
        } else {
            paths.push((Some(relative), true));
        }
    }

    for (index, (relative_opt, is_directory)) in paths.into_iter().enumerate() {
        let Some(relative) = relative_opt else {
            continue;
        };
        let output = destination.join(relative);
        if is_directory {
            fs::create_dir_all(&output)?;
            continue;
        }
        let parent = output
            .parent()
            .ok_or_else(|| AppError::new("archive_invalid_path"))?;
        fs::create_dir_all(parent)?;
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|error| {
                AppError::with_detail("archive_extract_file_failed", error.to_string())
            })?;
        archive
            .by_index(index)
            .map_err(|error| AppError::with_detail("archive_entry_read_failed", error.to_string()))?
            .copy_to(&mut target)
            .map_err(|error| {
                AppError::with_detail("archive_extract_file_failed", error.to_string())
            })?;
    }
    Ok(stats)
}
