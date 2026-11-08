use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Read};
use std::path::Path;
use zip::{ZipArchive, ZipReadOptions};

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
    let mut archive = ZipArchive::new(file)
        .map_err(|error| AppError::with_detail("archive_open_failed", error.to_string()))?;
    if archive.is_empty() {
        return Err(AppError::new("archive_empty_or_too_many_entries"));
    }

    let mut written_paths = HashSet::new();
    let mut total_written = 0_u64;
    let mut stats = ExtractStats::default();

    for index in 0..archive.len() {
        let options = ZipReadOptions::new().enforce_header_consistency(true);
        let entry = archive
            .by_index_with_options(index, options)
            .map_err(|error| {
                AppError::with_detail("archive_entry_read_failed", error.to_string())
            })?;
        if entry.is_symlink() {
            return Err(AppError::new("archive_symlink_rejected"));
        }
        let mode = entry.unix_mode().unwrap_or_default() & 0o170000;
        if mode != 0 && mode != 0o100000 && mode != 0o040000 {
            return Err(AppError::new("archive_special_file_rejected"));
        }
        let raw_name = entry
            .name()
            .map_err(|error| AppError::with_detail("archive_entry_read_failed", error.to_string()))?
            .into_owned();
        let relative = safe_archive_path(&raw_name)?;
        let output = destination.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&output)?;
            continue;
        }

        match check_archive_entry_allowed(&relative) {
            ArchiveEntryFilter::Allowed => {}
            ArchiveEntryFilter::DisallowedExecutable => {
                stats.skipped_files += 1;
                stats.skipped_executables += 1;
                continue;
            }
            ArchiveEntryFilter::DisallowedOther => {
                stats.skipped_files += 1;
                continue;
            }
        }

        stats.extracted_files += 1;
        if stats.extracted_files > MAX_ARCHIVE_ENTRIES {
            return Err(AppError::new("archive_limits_exceeded"));
        }

        let expected = entry.size();
        if expected > MAX_ENTRY_BYTES || total_written.saturating_add(expected) > size_limit {
            return Err(AppError::new("archive_limits_exceeded"));
        }
        if !written_paths.insert(output.clone()) {
            return Err(AppError::new("archive_duplicate_paths"));
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
        let remaining = size_limit.saturating_sub(total_written);
        let copied = io::copy(&mut entry.take(remaining.saturating_add(1)), &mut target).map_err(
            |error| AppError::with_detail("archive_extract_file_failed", error.to_string()),
        )?;
        if copied > remaining || copied != expected {
            return Err(AppError::new("archive_limits_exceeded"));
        }
        total_written += copied;
    }
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::extract;
    use crate::skins::paths::contains_skin_definition;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn build_test_zip(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
        let options = SimpleFileOptions::default();
        for (name, content) in entries {
            zip.start_file(*name, options).unwrap();
            zip.write_all(content).unwrap();
        }
        zip.finish().unwrap();
        file
    }

    #[test]
    fn extracts_allowed_files_and_skips_disallowed() {
        let zip_file = build_test_zip(&[
            ("skin.blk", b"set_skin {}"),
            ("diffuse.DDS", b"dds_content"),
            ("notes.txt", b"notes"),
            ("payload.exe", b"binary"),
            ("setup.BAT", b"@echo off"),
            ("LICENSE", b"mit license"),
            ("nested/texture.tga", b"tga_bytes"),
        ]);
        let dest = tempdir().unwrap();
        let stats = extract(zip_file.path(), dest.path(), 10 * 1024 * 1024).unwrap();

        assert_eq!(stats.extracted_files, 4); // skin.blk, diffuse.DDS, notes.txt, nested/texture.tga
        assert_eq!(stats.skipped_files, 3); // payload.exe, setup.BAT, LICENSE
        assert_eq!(stats.skipped_executables, 2); // payload.exe, setup.BAT

        assert!(dest.path().join("skin.blk").is_file());
        assert!(dest.path().join("diffuse.DDS").is_file());
        assert!(dest.path().join("notes.txt").is_file());
        assert!(dest.path().join("nested/texture.tga").is_file());

        assert!(!dest.path().join("payload.exe").exists());
        assert!(!dest.path().join("setup.BAT").exists());
        assert!(!dest.path().join("LICENSE").exists());

        assert!(contains_skin_definition(dest.path()).unwrap());
    }

    #[test]
    fn archive_with_only_disallowed_files_has_no_skin_definition() {
        let zip_file = build_test_zip(&[
            ("malicious.exe", b"exe data"),
            ("trojan.dll", b"dll data"),
            ("noextension", b"unknown"),
        ]);
        let dest = tempdir().unwrap();
        let stats = extract(zip_file.path(), dest.path(), 10 * 1024 * 1024).unwrap();

        assert_eq!(stats.extracted_files, 0);
        assert_eq!(stats.skipped_files, 3);
        assert_eq!(stats.skipped_executables, 2);
        assert!(!contains_skin_definition(dest.path()).unwrap());
    }
}
