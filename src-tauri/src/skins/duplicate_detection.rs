use serde::Serialize;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use super::download_task::DownloadControl;
use crate::AppError;

const MAX_COMPARE_FILES: usize = 5_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateSkinCandidate {
    pub folder_name: String,
    pub path: String,
    pub exact_content: bool,
    pub folder_name_match: bool,
    pub same_layout: bool,
    pub file_count: usize,
    pub size_bytes: u64,
}

pub(super) fn compare_external_skin(source: &Path, userskins: &Path, folder_name: &str, downloaded_folder_name: &str, control: &DownloadControl) -> Result<Option<DuplicateSkinCandidate>, AppError> {
    control.check_cancelled()?;
    if super::library::validate_skin_folder_name(folder_name).is_err() { return Ok(None); }
    let target = userskins.join(folder_name);
    let Ok(metadata) = fs::symlink_metadata(&target) else { return Ok(None) };
    if metadata.file_type().is_symlink() || !metadata.is_dir() { return Ok(None); }
    let Ok(userskins) = fs::canonicalize(userskins) else { return Ok(None) };
    let Ok(target) = fs::canonicalize(target) else { return Ok(None) };
    if target.parent() != Some(userskins.as_path()) { return Ok(None); }
    let folder_name_match = folder_name.eq_ignore_ascii_case(downloaded_folder_name);
    let source_manifest = safe_manifest(source).ok();
    let target_manifest = safe_manifest(&target).ok();
    let same_layout = source_manifest.as_ref().zip(target_manifest.as_ref())
        .is_some_and(|(source, target)| same_layout(source, target));
    if !folder_name_match && !same_layout { return Ok(None); }
    let exact_content = if same_layout {
        match same_content(source_manifest.as_ref().expect("matching source manifest"), target_manifest.as_ref().expect("matching target manifest"), Some(control)) {
            Ok(exact) => exact,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => return Err(AppError::new("download_cancelled")),
            Err(_) => false,
        }
    } else {
        false
    };
    let target_manifest = target_manifest.unwrap_or_default();
    Ok(Some(DuplicateSkinCandidate {
        folder_name: folder_name.to_string(),
        path: target.to_string_lossy().to_string(),
        exact_content,
        folder_name_match,
        same_layout,
        file_count: target_manifest.len(),
        size_bytes: manifest_size(&target_manifest),
    }))
}

pub(super) fn validate_external_link(userskins: &Path, folder_name: &str) -> Result<DuplicateSkinCandidate, AppError> {
    super::library::validate_skin_folder_name(folder_name)?;
    let target = userskins.join(folder_name);
    let metadata = fs::symlink_metadata(&target).map_err(|_| AppError::new("skin_duplicate_changed"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(AppError::new("skin_duplicate_changed"));
    }
    let userskins = fs::canonicalize(userskins).map_err(|_| AppError::new("skin_duplicate_changed"))?;
    let target = fs::canonicalize(target).map_err(|_| AppError::new("skin_duplicate_changed"))?;
    if target.parent() != Some(userskins.as_path()) {
        return Err(AppError::new("skin_duplicate_changed"));
    }
    let target_manifest = safe_manifest(&target).unwrap_or_default();
    Ok(DuplicateSkinCandidate {
        folder_name: folder_name.to_string(),
        path: target.to_string_lossy().to_string(),
        exact_content: false,
        folder_name_match: true,
        same_layout: false,
        file_count: target_manifest.len(),
        size_bytes: manifest_size(&target_manifest),
    })
}

type Manifest = BTreeMap<String, (PathBuf, u64)>;

fn safe_manifest(root: &Path) -> Result<Manifest, ()> {
    let mut pending = vec![root.to_path_buf()];
    let mut manifest = BTreeMap::new();
    let mut visited = 0usize;
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory).map_err(|_| ())? {
            visited += 1;
            if visited > MAX_COMPARE_FILES { return Err(()); }
            let entry = entry.map_err(|_| ())?;
            let kind = entry.file_type().map_err(|_| ())?;
            if kind.is_symlink() { return Err(()); }
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() {
                let path = entry.path();
                if path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("txt") || extension.eq_ignore_ascii_case("md")) {
                    continue;
                }
                let relative = path.strip_prefix(root).map_err(|_| ())?.to_string_lossy().replace('\\', "/").to_lowercase();
                let size = entry.metadata().map_err(|_| ())?.len();
                if manifest.insert(relative, (path, size)).is_some() { return Err(()); }
            } else {
                return Err(());
            }
        }
    }
    Ok(manifest)
}

fn same_layout(left: &Manifest, right: &Manifest) -> bool {
    left.len() == right.len() && left.iter().all(|(path, (_, size))| right.get(path).is_some_and(|(_, other_size)| size == other_size))
}

fn manifest_size(manifest: &Manifest) -> u64 {
    manifest.values().fold(0_u64, |total, (_, size)| total.saturating_add(*size))
}

fn same_content(left: &Manifest, right: &Manifest, control: Option<&DownloadControl>) -> std::io::Result<bool> {
    if !same_layout(left, right) { return Ok(false); }
    let mut left_buffer = [0_u8; 64 * 1024];
    let mut right_buffer = [0_u8; 64 * 1024];
    for (relative, (left_path, _)) in left {
        let right_path = &right[relative].0;
        let mut left_file = File::open(left_path)?;
        let mut right_file = File::open(right_path)?;
        loop {
            if control.is_some_and(|control| control.wait_until_resumed_blocking().is_err()) {
                return Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "skin comparison cancelled"));
            }
            let left_read = left_file.read(&mut left_buffer)?;
            let right_read = right_file.read(&mut right_buffer)?;
            if left_read != right_read || left_buffer[..left_read] != right_buffer[..right_read] { return Ok(false); }
            if left_read == 0 { break; }
        }
    }
    Ok(true)
}
