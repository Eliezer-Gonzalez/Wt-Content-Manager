use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppError;

use super::types::SoundPackage;

const PACKAGE_MANIFEST: &str = "package.json";
const PACKAGE_ARCHIVE: &str = "source.zip";

pub fn packages_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("sounds").join("packages")
}

pub fn prepare_download(
    app_data_dir: &Path,
    lang_group: u64,
) -> Result<(String, PathBuf, PathBuf), AppError> {
    let root = packages_root(app_data_dir);
    fs::create_dir_all(&root)?;
    let epoch_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AppError::new("sound_package_clock_error"))?
        .as_millis();
    for offset in 0..1_000_u128 {
        let id = format!("{lang_group}-{}", epoch_ms.saturating_add(offset));
        let directory = root.join(&id);
        if directory.exists() {
            continue;
        }
        fs::create_dir(&directory)?;
        return Ok((
            id,
            directory.join("source.part"),
            directory.join(PACKAGE_ARCHIVE),
        ));
    }
    Err(AppError::new("sound_package_id_unavailable"))
}

pub fn publish_package(app_data_dir: &Path, package: &SoundPackage) -> Result<(), AppError> {
    let directory = package_directory(app_data_dir, &package.id)?;
    if !directory.join(PACKAGE_ARCHIVE).is_file() {
        return Err(AppError::new("sound_package_archive_missing"));
    }
    let encoded = serde_json::to_vec_pretty(package).map_err(|error| {
        AppError::with_detail("sound_package_manifest_failed", error.to_string())
    })?;
    let temporary = directory.join("package.json.tmp");
    fs::write(&temporary, encoded)?;
    fs::rename(temporary, directory.join(PACKAGE_MANIFEST))?;
    Ok(())
}

pub fn list_packages(app_data_dir: &Path) -> Result<Vec<SoundPackage>, AppError> {
    let root = packages_root(app_data_dir);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut packages = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let manifest = entry.path().join(PACKAGE_MANIFEST);
        if !manifest.is_file() {
            continue;
        }
        let mut package: SoundPackage =
            serde_json::from_slice(&fs::read(manifest)?).map_err(|error| {
                AppError::with_detail("sound_package_manifest_invalid", error.to_string())
            })?;
        let expected_directory = package_directory(app_data_dir, &package.id)?;
        let archive_path = expected_directory.join(PACKAGE_ARCHIVE);
        if expected_directory != entry.path() {
            return Err(AppError::new("sound_package_manifest_invalid"));
        }
        if !archive_path.is_file() {
            continue;
        }
        if package.file_count.is_none() {
            package.file_count = super::archive::archive_file_count(&archive_path).ok();
        }
        packages.push(package);
    }
    packages.sort_by(|left, right| right.downloaded_at.cmp(&left.downloaded_at));
    Ok(packages)
}

pub fn package_archive(app_data_dir: &Path, package_id: &str) -> Result<PathBuf, AppError> {
    let archive = package_directory(app_data_dir, package_id)?.join(PACKAGE_ARCHIVE);
    if !archive.is_file() {
        return Err(AppError::new("sound_package_not_found"));
    }
    Ok(archive)
}

fn package_directory(app_data_dir: &Path, package_id: &str) -> Result<PathBuf, AppError> {
    let mut parts = package_id.split('-');
    let valid = parts
        .next()
        .is_some_and(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
        && parts
            .next()
            .is_some_and(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
        && parts.next().is_none();
    if !valid {
        return Err(AppError::new("sound_package_id_invalid"));
    }
    Ok(packages_root(app_data_dir).join(package_id))
}
