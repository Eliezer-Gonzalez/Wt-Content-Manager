use blake3::Hasher;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::{self, Read},
    path::{Component, Path, PathBuf},
};

const HASH_BUFFER_SIZE: usize = 128 * 1024;
const GLOBAL_HASH_DOMAIN: &[u8] = b"WT-CM-SKIN-FINGERPRINT\0v1\0";
#[cfg(windows)]
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkinFingerprint {
    pub(crate) files: Vec<SkinFingerprintFile>,
    pub(crate) global_hash: String,
    #[serde(default)]
    pub(crate) origin: FingerprintOrigin,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum FingerprintOrigin {
    #[default]
    Install,
    Baseline,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkinFingerprintFile {
    pub(crate) relative_path: String,
    pub(crate) size_bytes: u64,
    pub(crate) hash: String,
}

impl SkinFingerprint {
    pub(crate) fn compute(root: &Path) -> io::Result<Self> {
        Self::compute_controlled(root, |_| true)
    }

    pub(crate) fn compute_controlled(
        root: &Path,
        mut on_bytes: impl FnMut(u64) -> bool,
    ) -> io::Result<Self> {
        let metadata = fs::symlink_metadata(root)?;
        ensure_regular_directory(root, &metadata)?;
        let mut paths = Vec::new();
        collect_files(root, root, &mut paths)?;
        sort_paths(&mut paths);

        let mut files = Vec::with_capacity(paths.len());
        let mut total_bytes = 0_u64;
        for (relative_path, full_path) in paths {
            files.push(hash_file(relative_path, full_path, &mut total_bytes, &mut on_bytes)?);
        }
        Ok(Self {
            global_hash: hash_file_list(&files),
            files,
            origin: FingerprintOrigin::Install,
        })
    }

    pub(crate) fn as_baseline(mut self) -> Self {
        self.origin = FingerprintOrigin::Baseline;
        self
    }

    pub(crate) fn content_matches(&self, other: &Self) -> bool {
        self.global_hash == other.global_hash && self.files == other.files
    }

    pub(crate) fn is_valid(&self) -> bool {
        is_hex_hash(&self.global_hash)
            && self.files.iter().all(|file| {
                is_hex_hash(&file.hash)
                    && !file.relative_path.is_empty()
                    && !file.relative_path.starts_with('/')
                    && !file
                        .relative_path
                        .split('/')
                        .any(|part| part.is_empty() || part == "." || part == "..")
            })
            && self
                .files
                .windows(2)
                .all(|pair| pair[0].relative_path.as_bytes() < pair[1].relative_path.as_bytes())
            && hash_file_list(&self.files) == self.global_hash
    }

    pub(crate) fn matches_path(&self, path: &Path) -> bool {
        Self::compute(path).is_ok_and(|actual| self.content_matches(&actual))
    }
}

fn is_hex_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn collect_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<(String, PathBuf)>,
) -> io::Result<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)?;
        ensure_not_reparse_or_symlink(&path, &metadata)?;
        if metadata.is_dir() {
            collect_files(root, &path, files)?;
        } else if metadata.is_file() {
            files.push((normalize_relative_path(root, &path)?, path));
        } else {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported skin entry: {}", path.display()),
            ));
        }
    }
    Ok(())
}

fn normalize_relative_path(root: &Path, path: &Path) -> io::Result<String> {
    let relative = path.strip_prefix(root).map_err(|_| invalid_path(path))?;
    let mut parts = Vec::new();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(invalid_path(relative));
        };
        let part = part.to_str().ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidData, "skin path is not valid UTF-8")
        })?;
        if part.is_empty() || part.contains('/') || part.contains('\\') {
            return Err(invalid_path(relative));
        }
        parts.push(part);
    }
    if parts.is_empty() {
        return Err(invalid_path(relative));
    }
    Ok(parts.join("/"))
}

fn hash_file(
    relative_path: String,
    path: PathBuf,
    total_bytes: &mut u64,
    on_bytes: &mut impl FnMut(u64) -> bool,
) -> io::Result<SkinFingerprintFile> {
    let mut file = File::open(&path)?;
    let mut hasher = Hasher::new();
    let mut buffer = [0_u8; HASH_BUFFER_SIZE];
    let mut size_bytes = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        *total_bytes = total_bytes
            .checked_add(read as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "skin total size overflow"))?;
        if !on_bytes(*total_bytes) {
            return Err(io::Error::new(io::ErrorKind::Interrupted, "skin fingerprint cancelled"));
        }
        size_bytes = size_bytes
            .checked_add(read as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "skin file size overflow"))?;
        hasher.update(&buffer[..read]);
    }
    Ok(SkinFingerprintFile {
        relative_path,
        size_bytes,
        hash: hasher.finalize().to_hex().to_string(),
    })
}

fn hash_file_list(files: &[SkinFingerprintFile]) -> String {
    let mut hasher = Hasher::new();
    hasher.update(GLOBAL_HASH_DOMAIN);
    hasher.update(&(files.len() as u64).to_be_bytes());
    for file in files {
        let path = file.relative_path.as_bytes();
        hasher.update(&(path.len() as u64).to_be_bytes());
        hasher.update(path);
        hasher.update(&file.size_bytes.to_be_bytes());
        let raw_hash = decode_hash(&file.hash);
        hasher.update(&raw_hash);
    }
    hasher.finalize().to_hex().to_string()
}

fn sort_paths(paths: &mut [(String, PathBuf)]) {
    paths.sort_by(|left, right| left.0.as_bytes().cmp(right.0.as_bytes()));
}

fn decode_hash(value: &str) -> [u8; 32] {
    let mut bytes = [0_u8; 32];
    for (index, slot) in bytes.iter_mut().enumerate() {
        *slot = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .expect("BLAKE3 digest is hexadecimal");
    }
    bytes
}

fn ensure_regular_directory(path: &Path, metadata: &fs::Metadata) -> io::Result<()> {
    ensure_not_reparse_or_symlink(path, metadata)?;
    if !metadata.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "skin root is not a directory",
        ));
    }
    Ok(())
}

fn ensure_not_reparse_or_symlink(path: &Path, metadata: &fs::Metadata) -> io::Result<()> {
    if metadata.file_type().is_symlink() || is_reparse_point(metadata) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "skin contains a symbolic link or reparse point: {}",
                path.display()
            ),
        ));
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
pub(crate) fn is_reparse_point(_: &fs::Metadata) -> bool {
    false
}

fn invalid_path(path: &Path) -> io::Error {
    io::Error::new(
        io::ErrorKind::InvalidData,
        format!("skin path cannot be normalized safely: {}", path.display()),
    )
}

#[cfg(test)]
#[path = "fingerprint/tests.rs"]
mod tests;
