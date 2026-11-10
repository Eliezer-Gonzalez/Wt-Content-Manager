use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Read};
use std::path::Path;
use zip::{ZipArchive, ZipReadOptions};

use crate::AppError;

const MAX_ARCHIVE_ENTRIES: usize = 20_000;
const MAX_BANK_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BANK_BYTES: u64 = 3 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Default)]
pub struct BankInventory {
    pub count: usize,
    pub size_bytes: u64,
}

pub fn extract_banks(archive_path: &Path, destination: &Path) -> Result<BankInventory, AppError> {
    let file = fs::File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| AppError::with_detail("sound_archive_open_failed", error.to_string()))?;
    if archive.is_empty() || archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(AppError::new("sound_archive_limits_exceeded"));
    }

    let mut names = HashSet::new();
    let mut inventory = BankInventory::default();
    for index in 0..archive.len() {
        let options = ZipReadOptions::new().enforce_header_consistency(true);
        let mut entry = archive
            .by_index_with_options(index, options)
            .map_err(|error| {
                AppError::with_detail("sound_archive_entry_invalid", error.to_string())
            })?;
        if entry.is_symlink() {
            return Err(AppError::new("sound_archive_link_rejected"));
        }
        if entry.is_dir() {
            continue;
        }
        let raw_path = entry
            .name()
            .map_err(|error| {
                AppError::with_detail("sound_archive_entry_invalid", error.to_string())
            })?
            .into_owned();
        let relative = crate::skins::paths::safe_archive_path(&raw_path)?;
        if !relative
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("bank"))
        {
            continue;
        }

        let bank_name = relative
            .file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| AppError::new("sound_archive_entry_invalid"))?;
        let key = bank_name.to_string_lossy().to_lowercase();
        if !names.insert(key) {
            return Err(AppError::new("sound_archive_duplicate_bank"));
        }
        let expected = entry.size();
        if expected == 0
            || expected > MAX_BANK_BYTES
            || inventory.size_bytes.saturating_add(expected) > MAX_TOTAL_BANK_BYTES
        {
            return Err(AppError::new("sound_archive_limits_exceeded"));
        }

        let output = destination.join(bank_name);
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)
            .map_err(|error| {
                AppError::with_detail("sound_archive_extract_failed", error.to_string())
            })?;
        let remaining = MAX_TOTAL_BANK_BYTES.saturating_sub(inventory.size_bytes);
        let copied = io::copy(
            &mut entry.by_ref().take(remaining.saturating_add(1)),
            &mut target,
        )
        .map_err(|error| {
            AppError::with_detail("sound_archive_extract_failed", error.to_string())
        })?;
        if copied != expected || copied > remaining {
            return Err(AppError::new("sound_archive_limits_exceeded"));
        }
        inventory.count += 1;
        inventory.size_bytes += copied;
    }
    if inventory.count == 0 {
        return Err(AppError::new("sound_archive_no_banks"));
    }
    Ok(inventory)
}

#[cfg(test)]
mod tests {
    use super::extract_banks;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn build_zip(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
        for (name, data) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(data).unwrap();
        }
        zip.finish().unwrap();
        file
    }

    #[test]
    fn extracts_only_flat_banks_and_skips_readme_files() {
        let archive = build_zip(&[
            ("Common/aircraft_engines.bank", b"engine"),
            ("Common/README.txt", b"instructions"),
            ("setup.exe", b"not deployed"),
        ]);
        let destination = tempdir().unwrap();
        let inventory = extract_banks(archive.path(), destination.path()).unwrap();
        assert_eq!(inventory.count, 1);
        assert_eq!(
            std::fs::read(destination.path().join("aircraft_engines.bank")).unwrap(),
            b"engine"
        );
        assert_eq!(std::fs::read_dir(destination.path()).unwrap().count(), 1);
    }

    #[test]
    fn rejects_duplicate_bank_names_case_insensitively() {
        let archive = build_zip(&[
            ("Common/masterbank.bank", b"one"),
            ("Optional/MASTERBANK.BANK", b"two"),
        ]);
        let destination = tempdir().unwrap();
        assert_eq!(
            extract_banks(archive.path(), destination.path())
                .unwrap_err()
                .code,
            "sound_archive_duplicate_bank"
        );
    }

    #[test]
    fn rejects_archives_without_sound_banks() {
        let archive = build_zip(&[("README.txt", b"instructions")]);
        let destination = tempdir().unwrap();
        assert_eq!(
            extract_banks(archive.path(), destination.path())
                .unwrap_err()
                .code,
            "sound_archive_no_banks"
        );
    }
}
