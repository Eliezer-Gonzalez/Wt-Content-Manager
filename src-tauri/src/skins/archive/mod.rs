mod zip;

use std::fs::File;
use std::io::Read;
use std::path::Path;

use crate::AppError;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ExtractStats {
    pub extracted_files: usize,
    pub skipped_files: usize,
    pub skipped_executables: usize,
}

pub fn extract(archive: &Path, destination: &Path, limit: u64) -> Result<ExtractStats, AppError> {
    let mut file = File::open(archive)?;
    let mut signature = [0; 4];
    let bytes_read = file.read(&mut signature)?;
    let is_zip = bytes_read == signature.len()
        && matches!(
            signature,
            [b'P', b'K', 3, 4] | [b'P', b'K', 5, 6] | [b'P', b'K', 7, 8]
        );
    if !is_zip {
        return Err(AppError::new("archive_unsupported_format"));
    }
    zip::extract(archive, destination, limit)
}
