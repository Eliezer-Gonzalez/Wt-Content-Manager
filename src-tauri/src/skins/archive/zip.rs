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
    if archive.is_empty() || archive.len() > MAX_ARCHIVE_ENTRIES {
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
        if !written_paths.insert(relative.to_string_lossy().to_lowercase()) {
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
    use crate::skins::{
        archive,
        paths::{contains_skin_definition, select_skin_root, MAX_ARCHIVE_ENTRIES},
    };
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
    fn rejects_duplicate_paths_case_insensitively() {
        let zip_file = build_test_zip(&[
            ("MetalCrab/skin.blk", b"first"),
            ("metalcrab/SKIN.BLK", b"second"),
        ]);
        let destination = tempdir().unwrap();
        let error = extract(zip_file.path(), destination.path(), 10_000).unwrap_err();
        assert_eq!(error.code, "archive_duplicate_paths");
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

    #[test]
    fn rejects_non_zip_content_regardless_of_extension() {
        let archive_file = tempfile::Builder::new().suffix(".zip").tempfile().unwrap();
        std::fs::write(archive_file.path(), b"not a zip archive").unwrap();
        let dest = tempdir().unwrap();

        let error =
            archive::extract(archive_file.path(), dest.path(), 10 * 1024 * 1024).unwrap_err();

        assert_eq!(error.code, "archive_unsupported_format");
    }

    #[test]
    fn extracts_zip_content_regardless_of_extension() {
        let zip_file = build_test_zip(&[("skin.blk", b"set_skin {}")]);
        let archive_file = tempfile::Builder::new().suffix(".rar").tempfile().unwrap();
        std::fs::copy(zip_file.path(), archive_file.path()).unwrap();
        let dest = tempdir().unwrap();

        let stats = archive::extract(archive_file.path(), dest.path(), 10 * 1024 * 1024).unwrap();

        assert_eq!(stats.extracted_files, 1);
        assert!(dest.path().join("skin.blk").is_file());
    }

    #[test]
    fn rejects_archive_with_too_many_directory_entries_before_writing() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
        let options = SimpleFileOptions::default();
        zip.start_file("MySkin/skin.blk", options).unwrap();
        zip.write_all(b"name:t=\"user\"").unwrap();
        for index in 0..MAX_ARCHIVE_ENTRIES {
            zip.add_directory(format!("empty-{index}/"), options)
                .unwrap();
        }
        zip.finish().unwrap();

        let dest = tempdir().unwrap();
        let error = extract(file.path(), dest.path(), 10 * 1024 * 1024).unwrap_err();

        assert_eq!(error.code, "archive_empty_or_too_many_entries");
        assert_eq!(std::fs::read_dir(dest.path()).unwrap().count(), 0);
    }

    #[test]
    fn ignores_empty_directory_entries_when_selecting_skin_root() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
        let options = SimpleFileOptions::default();
        zip.add_directory("__MACOSX/", options).unwrap();
        zip.start_file("MySkin/skin.blk", options).unwrap();
        zip.write_all(b"name:t=\"user\"").unwrap();
        zip.finish().unwrap();

        let payload = tempdir().unwrap();
        extract(file.path(), payload.path(), 10 * 1024 * 1024).unwrap();
        let (skin_root, folder_name) = select_skin_root(payload.path(), "skin.zip").unwrap();

        assert_eq!(folder_name, "MySkin");
        assert_eq!(skin_root, payload.path().join("MySkin"));
        assert!(!payload.path().join("__MACOSX").exists());
    }
}
