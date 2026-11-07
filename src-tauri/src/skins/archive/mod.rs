mod rar;
mod zip;

use std::path::Path;

use crate::AppError;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ExtractStats {
    pub extracted_files: usize,
    pub skipped_files: usize,
    pub skipped_executables: usize,
}

pub fn extract(
    archive: &Path,
    archive_name: &str,
    destination: &Path,
    limit: u64,
) -> Result<ExtractStats, AppError> {
    let stats = match archive_name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "zip" => zip::extract(archive, destination, limit)?,
        "rar" => rar::extract(archive, destination, limit)?,
        _ => return Err(AppError::new("archive_unsupported_format")),
    };
    Ok(stats)
}
