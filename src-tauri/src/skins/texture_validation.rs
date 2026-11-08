use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use super::paths::{safe_archive_path, walk_files};

const MAX_SCAN_BYTES: u64 = 8 * 1024 * 1024;
const MAX_REPORTED_NAMES: usize = 5;
const REFERENCE_MARKER: &str = "to:t=\"";

#[derive(Default)]
pub struct MissingTextureReport {
    pub count: usize,
    pub names: Vec<String>,
}

pub fn find_missing_references(root: &Path) -> MissingTextureReport {
    let Ok(files) = walk_files(root) else {
        return MissingTextureReport::default();
    };

    let mut remaining_scan_bytes = MAX_SCAN_BYTES;
    let mut missing = Vec::new();
    let mut seen = HashSet::new();

    for file_path in files {
        if !file_path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("blk"))
        {
            continue;
        }

        let Ok(metadata) = file_path.metadata() else {
            continue;
        };
        let bytes_to_read = metadata.len().min(remaining_scan_bytes);
        if bytes_to_read == 0 {
            break;
        }
        let Ok(file) = File::open(&file_path) else {
            continue;
        };
        let mut bytes = Vec::with_capacity(bytes_to_read as usize);
        if file.take(bytes_to_read).read_to_end(&mut bytes).is_err() {
            continue;
        }
        remaining_scan_bytes -= bytes.len() as u64;
        let contents = String::from_utf8_lossy(&bytes);

        for reference in texture_references(&contents) {
            let Ok(relative_path) = safe_archive_path(reference) else {
                continue;
            };
            if !relative_path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("dds"))
            {
                continue;
            }

            let normalized = reference.replace('\\', "/");
            let key = normalized.to_ascii_lowercase();
            if !root.join(relative_path).is_file() && seen.insert(key) {
                missing.push(normalized);
            }
        }
    }

    missing.sort_by_key(|name| name.to_ascii_lowercase());
    let count = missing.len();
    missing.truncate(MAX_REPORTED_NAMES);
    MissingTextureReport {
        count,
        names: missing,
    }
}

fn texture_references(contents: &str) -> impl Iterator<Item = &str> {
    contents
        .match_indices(REFERENCE_MARKER)
        .filter_map(|(start, _)| {
            let value_start = start + REFERENCE_MARKER.len();
            let value_tail = &contents[value_start..];
            let value_end = value_tail.find('\"')?;
            Some(&value_tail[..value_end])
        })
}
