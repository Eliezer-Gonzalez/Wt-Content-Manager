use std::path::{Component, Path, PathBuf};

use crate::AppError;

pub const MAX_ARCHIVE_ENTRIES: usize = 3000;
pub const MAX_ARCHIVE_DEPTH: usize = 8;
pub const MAX_ENTRY_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveEntryFilter {
    Allowed,
    DisallowedExecutable,
    DisallowedOther,
}

pub fn check_archive_entry_allowed(path: &Path) -> ArchiveEntryFilter {
    let extension = match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => ext.to_ascii_lowercase(),
        None => return ArchiveEntryFilter::DisallowedOther,
    };

    const ALLOWED: &[&str] = &[
        "blk", "dds", "tga", "png", "jpg", "jpeg", "csv", "txt", "md",
    ];
    if ALLOWED.contains(&extension.as_str()) {
        return ArchiveEntryFilter::Allowed;
    }

    const EXECUTABLE: &[&str] = &[
        "exe", "dll", "bat", "cmd", "com", "scr", "msi", "lnk", "vbs", "vbe", "js", "jse", "wsf",
        "ps1", "sh",
    ];
    if EXECUTABLE.contains(&extension.as_str()) {
        return ArchiveEntryFilter::DisallowedExecutable;
    }

    ArchiveEntryFilter::DisallowedOther
}

pub fn safe_archive_path(raw: &str) -> Result<PathBuf, AppError> {
    if raw.contains('\0') {
        return Err(AppError::new("archive_invalid_path"));
    }
    let normalized = raw.replace('\\', "/");
    if normalized.contains(':') {
        return Err(AppError::new("archive_invalid_path"));
    }
    let path = Path::new(&normalized);
    if path.is_absolute() || normalized.starts_with('/') {
        return Err(AppError::new("archive_absolute_path"));
    }
    let mut safe = PathBuf::new();
    let mut depth = 0;
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                depth += 1;
                if depth > MAX_ARCHIVE_DEPTH {
                    return Err(AppError::new("archive_limits_exceeded")
                        .with_param("reason", "archive_path_depth")
                        .with_param("path_depth", depth)
                        .with_param("max_depth", MAX_ARCHIVE_DEPTH));
                }
                let value = value.to_string_lossy();
                if value.ends_with([' ', '.']) || is_windows_reserved(&value) {
                    return Err(AppError::new("archive_invalid_filename"));
                }
                safe.push(value.as_ref());
            }
            Component::CurDir => {}
            _ => return Err(AppError::new("archive_path_escape")),
        }
    }
    if safe.as_os_str().is_empty() {
        return Err(AppError::new("archive_empty_path"));
    }
    Ok(safe)
}

pub(crate) fn is_windows_reserved(name: &str) -> bool {
    let stem = name
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end_matches([' ', '.'])
        .to_ascii_uppercase();
    matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ["COM", "LPT"].iter().any(|prefix| {
        stem.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    })
}

pub fn archive_stem(name: &str) -> String {
    let basename = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let stem = basename.rsplit_once('.').map_or(basename, |(stem, _)| stem);
    sanitize_folder_name(stem)
}

pub fn sanitize_folder_name(name: &str) -> String {
    let cleaned: String = name
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .map(|character| {
            if "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .take(80)
        .collect();
    let cleaned = cleaned.trim_matches([' ', '.']);
    if cleaned.is_empty() || is_windows_reserved(cleaned) {
        "War Thunder skin".into()
    } else {
        cleaned.into()
    }
}
