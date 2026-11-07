mod rar;
mod zip;

use std::path::{Path, PathBuf};

pub fn extract(
    archive: &Path,
    archive_name: &str,
    destination: &Path,
    limit: u64,
) -> Result<PathBuf, String> {
    match archive_name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "zip" => zip::extract(archive, destination, limit)?,
        "rar" => rar::extract(archive, destination, limit)?,
        _ => return Err("WT Live devolvió un formato no compatible. Se admiten ZIP y RAR.".into()),
    }
    Ok(destination.to_path_buf())
}
