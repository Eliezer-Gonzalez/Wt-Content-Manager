use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path};
use std::time::UNIX_EPOCH;

use super::paths::{contains_skin_definition, count_files, total_size};
use crate::{game_install, AppError};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSkin {
    pub folder_name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
    pub modified_at_ms: Option<u64>,
}

pub fn scan_installed_skins(game_path: &str) -> Result<Vec<ScannedSkin>, AppError> {
    game_install::validate(game_path)?;

    let userskins = Path::new(game_path).join("UserSkins");
    if !userskins.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&userskins)?;
    let mut skins = Vec::new();

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() || !file_type.is_dir() {
            continue;
        }

        let folder_name = entry.file_name().to_string_lossy().to_string();
        if folder_name.starts_with('.') || super::is_orphan_staging_dir(&folder_name) {
            continue;
        }

        let dir_path = entry.path();
        if !contains_skin_definition(&dir_path).unwrap_or(false) {
            continue;
        }

        let Ok(file_count) = count_files(&dir_path) else {
            continue;
        };
        if file_count == 0 {
            continue;
        }

        let Ok(size_bytes) = total_size(&dir_path) else {
            continue;
        };

        let modified_at_ms = entry
            .metadata()
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .and_then(|duration| u64::try_from(duration.as_millis()).ok());

        skins.push(ScannedSkin {
            folder_name,
            path: dir_path.to_string_lossy().to_string(),
            file_count,
            size_bytes,
            modified_at_ms,
        });
    }

    skins.sort_by(|a, b| {
        b.modified_at_ms
            .cmp(&a.modified_at_ms)
            .then_with(|| a.folder_name.cmp(&b.folder_name))
    });

    Ok(skins)
}

fn validate_skin_folder_name(folder_name: &str) -> Result<(), AppError> {
    if folder_name.is_empty()
        || folder_name.starts_with('.')
        || super::is_orphan_staging_dir(folder_name)
        || folder_name.contains(['/', '\\', ':', '\0'])
    {
        return Err(AppError::new("skin_invalid_folder"));
    }

    let mut components = Path::new(folder_name).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(()),
        _ => Err(AppError::new("skin_invalid_folder")),
    }
}

fn map_uninstall_io_error(error: std::io::Error) -> AppError {
    if error.kind() == ErrorKind::PermissionDenied {
        AppError::with_detail("game_permission_denied", error.to_string())
    } else {
        AppError::with_detail("skin_uninstall_failed", error.to_string())
    }
}

pub fn uninstall_skin(game_path: &str, folder_name: &str) -> Result<(), AppError> {
    game_install::validate(game_path)?;
    validate_skin_folder_name(folder_name)?;

    let userskins = Path::new(game_path).join("UserSkins");
    let target = userskins.join(folder_name);

    let metadata = match fs::symlink_metadata(&target) {
        Ok(meta) => meta,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Err(AppError::new("skin_not_found"));
        }
        Err(error) => return Err(map_uninstall_io_error(error)),
    };

    if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() {
        return Err(AppError::new("skin_invalid_folder"));
    }

    let userskins_canon = fs::canonicalize(&userskins).map_err(map_uninstall_io_error)?;
    let target_canon = fs::canonicalize(&target).map_err(map_uninstall_io_error)?;

    if target_canon.parent() != Some(userskins_canon.as_path()) {
        return Err(AppError::new("skin_invalid_folder"));
    }

    fs::remove_dir_all(&target).map_err(map_uninstall_io_error)
}

#[cfg(test)]
mod tests {
    use super::{scan_installed_skins, uninstall_skin};
    use std::fs;
    use tempfile::TempDir;

    fn create_fake_game_root() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("aces.exe"), b"stub").unwrap();
        dir
    }

    #[test]
    fn scans_valid_skin_folders_and_ignores_non_skin_and_staging_folders() {
        let game = create_fake_game_root();
        let userskins = game.path().join("UserSkins");
        fs::create_dir_all(&userskins).unwrap();

        // Valid skin folder with .blk and texture
        let valid_skin = userskins.join("Spitfire Mk IX");
        fs::create_dir(&valid_skin).unwrap();
        fs::write(valid_skin.join("spitfire.blk"), b"name:t=\"user\"").unwrap();
        fs::write(valid_skin.join("camo.dds"), b"123456").unwrap();

        // Non-skin folder without .blk
        let no_blk = userskins.join("RandomFolder");
        fs::create_dir(&no_blk).unwrap();
        fs::write(no_blk.join("readme.txt"), b"notes").unwrap();

        // Hidden / staging folder even if it has a .blk inside
        let staging = userskins.join(".wtcm-staging-1234567890abcdef");
        fs::create_dir(&staging).unwrap();
        fs::write(staging.join("temp.blk"), b"staging").unwrap();

        let game_str = game.path().to_str().unwrap();
        let scanned = scan_installed_skins(game_str).unwrap();

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].folder_name, "Spitfire Mk IX");
        assert_eq!(scanned[0].file_count, 2);
        assert_eq!(scanned[0].size_bytes, 19);
        assert!(scanned[0].modified_at_ms.is_some());
    }

    #[test]
    fn uninstalls_valid_skin_folder() {
        let game = create_fake_game_root();
        let userskins = game.path().join("UserSkins");
        let skin_dir = userskins.join("F-16C Block 50");
        fs::create_dir_all(&skin_dir).unwrap();
        fs::write(skin_dir.join("f_16c.blk"), b"blk").unwrap();

        let game_str = game.path().to_str().unwrap();
        uninstall_skin(game_str, "F-16C Block 50").unwrap();

        assert!(!skin_dir.exists());
        assert!(userskins.exists());
    }

    #[test]
    fn rejects_traversal_staging_and_missing_folders_on_uninstall() {
        let game = create_fake_game_root();
        let userskins = game.path().join("UserSkins");
        fs::create_dir_all(&userskins).unwrap();

        let staging = userskins.join(".wtcm-staging-1234567890abcdef");
        fs::create_dir(&staging).unwrap();

        let game_str = game.path().to_str().unwrap();

        for invalid in [
            "",
            ".",
            "..",
            "../",
            "..\\UserSkins",
            "a/b",
            "a\\b",
            "C:skin",
            ".hidden",
            ".wtcm-staging-1234567890abcdef",
        ] {
            let err = uninstall_skin(game_str, invalid).unwrap_err();
            assert_eq!(err.code, "skin_invalid_folder", "failed on input: {invalid}");
        }

        assert!(staging.exists());

        let missing_err = uninstall_skin(game_str, "NonExistentSkin").unwrap_err();
        assert_eq!(missing_err.code, "skin_not_found");
    }
}
