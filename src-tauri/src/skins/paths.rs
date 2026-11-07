use std::fs;
use std::path::{Component, Path, PathBuf};

pub const MAX_ARCHIVE_ENTRIES: usize = 3000;
pub const MAX_ENTRY_BYTES: u64 = 256 * 1024 * 1024;

pub fn safe_archive_path(raw: &str) -> Result<PathBuf, String> {
    if raw.contains('\0') || raw.contains('\\') || raw.contains(':') {
        return Err("El archivo comprimido contiene una ruta no permitida.".into());
    }
    let path = Path::new(raw);
    if path.is_absolute() {
        return Err("El archivo comprimido contiene una ruta absoluta.".into());
    }
    let mut safe = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                let value = value.to_string_lossy();
                if value.ends_with([' ', '.']) || is_windows_reserved(&value) {
                    return Err(
                        "El archivo comprimido contiene un nombre de archivo no permitido.".into(),
                    );
                }
                safe.push(value.as_ref());
            }
            Component::CurDir => {}
            _ => return Err("El archivo comprimido intenta salir de su carpeta.".into()),
        }
    }
    if safe.as_os_str().is_empty() {
        return Err("El archivo comprimido contiene una ruta vacía.".into());
    }
    Ok(safe)
}

fn is_windows_reserved(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|prefix| {
            stem.strip_prefix(prefix).is_some_and(|suffix| {
                matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
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

pub fn select_skin_root(payload: &Path, archive_name: &str) -> Result<(PathBuf, String), String> {
    let entries = fs::read_dir(payload)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if entries.len() == 1
        && entries[0]
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
    {
        let outer = entries[0].path();
        let outer_name = entries[0].file_name().to_string_lossy().to_string();
        if outer_name.eq_ignore_ascii_case("UserSkins") {
            let inner = fs::read_dir(&outer)
                .map_err(|error| error.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| error.to_string())?;
            if inner.len() == 1
                && inner[0]
                    .file_type()
                    .map_err(|error| error.to_string())?
                    .is_dir()
            {
                let name = sanitize_folder_name(&inner[0].file_name().to_string_lossy());
                return Ok((inner[0].path(), name));
            }
            return Ok((outer, archive_stem(archive_name)));
        }
        return Ok((outer, sanitize_folder_name(&outer_name)));
    }
    Ok((payload.to_path_buf(), archive_stem(archive_name)))
}

pub fn unique_folder_name(root: &Path, desired: &str) -> Result<String, String> {
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
    Err("Ya hay demasiadas skins con ese nombre en UserSkins.".into())
}

pub fn count_files(root: &Path) -> Result<usize, String> {
    Ok(walk_files(root)?.len())
}

pub fn total_size(root: &Path) -> Result<u64, String> {
    walk_files(root)?.iter().try_fold(0_u64, |total, file| {
        let size = file.metadata().map_err(|error| error.to_string())?.len();
        total
            .checked_add(size)
            .ok_or_else(|| "El tamaño extraído no es válido.".to_string())
    })
}

pub fn contains_skin_definition(root: &Path) -> Result<bool, String> {
    Ok(walk_files(root)?.iter().any(|file| {
        file.extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("blk"))
    }))
}

fn walk_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut pending = vec![root.to_path_buf()];
    let mut files = Vec::new();
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let kind = entry.file_type().map_err(|error| error.to_string())?;
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() {
                files.push(entry.path());
            } else {
                return Err("La skin contiene un tipo de archivo no permitido.".into());
            }
        }
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::{archive_stem, safe_archive_path, select_skin_root};

    #[test]
    fn rejects_archive_traversal_and_device_names() {
        assert!(safe_archive_path("../outside.blk").is_err());
        assert!(safe_archive_path("C:/outside.blk").is_err());
        assert!(safe_archive_path("folder/NUL.txt").is_err());
        assert!(safe_archive_path("folder/texture.blk").is_ok());
    }

    #[test]
    fn derives_folder_from_archive_filename() {
        assert_eq!(archive_stem("Z33 chocolate.rar"), "Z33 chocolate");
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
