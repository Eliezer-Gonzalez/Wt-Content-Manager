use std::fs;
use std::path::{Path, PathBuf};

pub(crate) use super::archive_paths::{
    archive_stem, check_archive_entry_allowed, is_windows_reserved, safe_archive_path,
    sanitize_folder_name, ArchiveEntryFilter, MAX_ARCHIVE_ENTRIES, MAX_ENTRY_BYTES,
};
use crate::AppError;

pub fn select_skin_root(payload: &Path, archive_name: &str) -> Result<(PathBuf, String), AppError> {
    let entries = fs::read_dir(payload)?.collect::<Result<Vec<_>, _>>()?;
    if entries.len() == 1 && entries[0].file_type()?.is_dir() {
        let outer = entries[0].path();
        let outer_name = entries[0].file_name().to_string_lossy().to_string();
        if outer_name.eq_ignore_ascii_case("UserSkins") {
            let inner = fs::read_dir(&outer)?.collect::<Result<Vec<_>, _>>()?;
            if inner.len() == 1 && inner[0].file_type()?.is_dir() {
                let name = sanitize_folder_name(&inner[0].file_name().to_string_lossy());
                return Ok((inner[0].path(), name));
            }
            return Ok((outer, archive_stem(archive_name)));
        }
        return Ok((outer, sanitize_folder_name(&outer_name)));
    }
    Ok((payload.to_path_buf(), archive_stem(archive_name)))
}

pub fn unique_folder_name(root: &Path, desired: &str) -> Result<String, AppError> {
    let desired = sanitize_folder_name(desired);
    if !root.join(&desired).exists() {
        return Ok(desired);
    }
    for number in 2..=999 {
        let candidate = format!("{desired} ({number})");
        if !root.join(&candidate).exists() {
            return Ok(candidate);
        }
    }
    Err(AppError::new("skin_name_collision_limit"))
}

pub fn count_files(root: &Path) -> Result<usize, AppError> {
    Ok(walk_files(root)?.len())
}

pub fn total_size(root: &Path) -> Result<u64, AppError> {
    walk_files(root)?.iter().try_fold(0_u64, |total, file| {
        let size = file.metadata()?.len();
        total
            .checked_add(size)
            .ok_or_else(|| AppError::new("archive_size_overflow"))
    })
}

pub fn contains_skin_definition(root: &Path) -> Result<bool, AppError> {
    Ok(walk_files(root)?.iter().any(|file| {
        file.extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("blk"))
    }))
}

pub(super) fn walk_files(root: &Path) -> Result<Vec<PathBuf>, AppError> {
    let mut pending = vec![root.to_path_buf()];
    let mut files = Vec::new();
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            let kind = entry.file_type()?;
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() {
                files.push(entry.path());
            } else {
                return Err(AppError::new("archive_disallowed_entry_type"));
            }
        }
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::{
        archive_stem, check_archive_entry_allowed, safe_archive_path, select_skin_root,
        ArchiveEntryFilter,
    };
    use std::path::Path;

    #[test]
    fn rejects_archive_traversal_and_device_names() {
        assert!(safe_archive_path("../outside.blk").is_err());
        assert!(safe_archive_path("C:/outside.blk").is_err());
        assert!(safe_archive_path("folder/NUL.txt").is_err());
        assert!(safe_archive_path("folder/CONIN$.blk").is_err());
        assert!(safe_archive_path("folder/CONOUT$.dds").is_err());
        assert!(safe_archive_path("folder/texture.blk").is_ok());
    }

    #[test]
    fn rejects_case_insensitive_reserved_names_and_trailing_dot_or_space() {
        for path in [
            "NUL .blk",
            "nUl.txt",
            "COM¹.blk",
            "lpt³.dds",
            "skin.",
            "skin ",
        ] {
            assert!(safe_archive_path(path).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn normalizes_backslashes_in_safe_archive_path() {
        assert_eq!(
            safe_archive_path("folder\\file.blk").unwrap(),
            Path::new("folder/file.blk")
        );
        assert!(safe_archive_path("..\\evil.txt").is_err());
        assert!(safe_archive_path("a\\..\\..\\b").is_err());
        assert!(safe_archive_path("C:\\x").is_err());
        assert!(safe_archive_path("/abs/path").is_err());
        assert!(safe_archive_path("\\abs\\path").is_err());
    }

    #[test]
    fn rejects_archive_paths_deeper_than_supported() {
        assert!(safe_archive_path("a/b/c/d/e/f/g/h/i/skin.blk").is_err());
    }

    #[test]
    fn filters_archive_entries_by_extension() {
        // Allowed files
        assert_eq!(
            check_archive_entry_allowed(Path::new("skin.blk")),
            ArchiveEntryFilter::Allowed
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("textures/diffuse.dds")),
            ArchiveEntryFilter::Allowed
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("readme.txt")),
            ArchiveEntryFilter::Allowed
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("info.md")),
            ArchiveEntryFilter::Allowed
        );

        // Case-insensitivity (uppercase)
        assert_eq!(
            check_archive_entry_allowed(Path::new("SKIN.BLK")),
            ArchiveEntryFilter::Allowed
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("CAMO.DDS")),
            ArchiveEntryFilter::Allowed
        );

        // Executables / scripts
        assert_eq!(
            check_archive_entry_allowed(Path::new("payload.exe")),
            ArchiveEntryFilter::DisallowedExecutable
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("hack.dll")),
            ArchiveEntryFilter::DisallowedExecutable
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("setup.bat")),
            ArchiveEntryFilter::DisallowedExecutable
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("script.ps1")),
            ArchiveEntryFilter::DisallowedExecutable
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("run.SH")),
            ArchiveEntryFilter::DisallowedExecutable
        );

        // Disallowed other / no extension
        assert_eq!(
            check_archive_entry_allowed(Path::new("LICENSE")),
            ArchiveEntryFilter::DisallowedOther
        );
        assert_eq!(
            check_archive_entry_allowed(Path::new("unknown.xyz")),
            ArchiveEntryFilter::DisallowedOther
        );
    }

    #[test]
    fn derives_folder_from_archive_filename() {
        assert_eq!(archive_stem("Z33 chocolate.zip"), "Z33 chocolate");
    }

    #[test]
    fn accepts_flat_payload_and_names_it_from_archive() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("skin.blk"), "content").unwrap();
        let (root, name) = select_skin_root(temp.path(), "Z33 choco.zip").unwrap();
        assert_eq!(root, temp.path());
        assert_eq!(name, "Z33 choco");
    }
}
