use serde_json::Value;
use std::{fs, io::Write, path::Path};
use tempfile::NamedTempFile;

const MAX_LIBRARY_BYTES: u64 = 16 * 1024 * 1024;

pub fn load(path: &Path) -> Result<Option<Value>, crate::AppError> {
    let _guard = crate::skins::install_journal::lock_local_library();
    load_unlocked(path)
}

pub(crate) fn load_unlocked(path: &Path) -> Result<Option<Value>, crate::AppError> {
    let backup = path.with_extension("json.bak");
    if !path.exists() {
        return read_existing(&backup).map(Some).or_else(|error| {
            if error.code == "local_library_missing" {
                Ok(None)
            } else {
                Err(error)
            }
        });
    }
    match read_existing(path) {
        Ok(value) => Ok(Some(value)),
        Err(primary_error) => read_existing(&backup).map(Some).or_else(|backup_error| {
            if backup_error.code == "local_library_missing" {
                Err(primary_error)
            } else {
                Err(backup_error)
            }
        }),
    }
}

fn read_existing(path: &Path) -> Result<Value, crate::AppError> {
    if !path.exists() {
        return Err(crate::AppError::new("local_library_missing"));
    }
    let metadata = fs::metadata(path).map_err(|error| {
        crate::AppError::with_detail("local_library_read_failed", error.to_string())
    })?;
    if metadata.len() > MAX_LIBRARY_BYTES {
        return Err(crate::AppError::new("local_library_too_large"));
    }
    let bytes = fs::read(path).map_err(|error| {
        crate::AppError::with_detail("local_library_read_failed", error.to_string())
    })?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| {
        crate::AppError::with_detail("local_library_corrupt", error.to_string())
    })?;
    validate_library(&value)?;
    Ok(value)
}

#[cfg(test)]
pub fn save(path: &Path, value: &Value) -> Result<(), crate::AppError> {
    let _guard = crate::skins::install_journal::lock_local_library();
    save_unlocked(path, value)
}

pub(crate) fn save_unlocked(path: &Path, value: &Value) -> Result<(), crate::AppError> {
    validate_library(value)?;
    let bytes = serde_json::to_vec(value).map_err(|error| {
        crate::AppError::with_detail("local_library_write_failed", error.to_string())
    })?;
    if bytes.len() as u64 > MAX_LIBRARY_BYTES {
        return Err(crate::AppError::new("local_library_too_large"));
    }

    let parent = path
        .parent()
        .ok_or_else(|| crate::AppError::new("local_library_write_failed"))?;
    fs::create_dir_all(parent).map_err(|error| {
        crate::AppError::with_detail("local_library_write_failed", error.to_string())
    })?;
    let mut temp = NamedTempFile::new_in(parent).map_err(|error| {
        crate::AppError::with_detail("local_library_write_failed", error.to_string())
    })?;
    temp.write_all(&bytes)
        .and_then(|()| temp.as_file().sync_all())
        .map_err(|error| {
            crate::AppError::with_detail("local_library_write_failed", error.to_string())
        })?;

    let backup = path.with_extension("json.bak");
    let had_previous = path.exists();
    if had_previous {
        let previous_is_valid = read_existing(path).is_ok();
        let corrupt_path = path.with_extension("json.corrupt");
        let previous_path = if previous_is_valid {
            if backup.exists() {
                fs::remove_file(&backup).map_err(|error| {
                    crate::AppError::with_detail("local_library_write_failed", error.to_string())
                })?;
            }
            backup.clone()
        } else {
            corrupt_path
        };
        if previous_path.exists() {
            fs::remove_file(&previous_path).map_err(|error| {
                crate::AppError::with_detail("local_library_write_failed", error.to_string())
            })?;
        }
        fs::rename(path, &previous_path).map_err(|error| {
            crate::AppError::with_detail("local_library_write_failed", error.to_string())
        })?;
    }

    if let Err(error) = temp.persist(path) {
        if had_previous {
            let recovery_path = if backup.exists() {
                backup
            } else {
                path.with_extension("json.corrupt")
            };
            let _ = fs::rename(&recovery_path, path);
        }
        return Err(crate::AppError::with_detail(
            "local_library_write_failed",
            error.to_string(),
        ));
    }
    Ok(())
}

fn validate_library(value: &Value) -> Result<(), crate::AppError> {
    let is_valid = value.as_object().is_some_and(|object| {
        object.get("favorites").is_some_and(Value::is_array)
            && object.get("installedSkins").is_some_and(Value::is_array)
            && object
                .get("externalSkinPublications")
                .is_none_or(Value::is_array)
            && object
                .get("favorites")
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().all(valid_item))
            && object
                .get("installedSkins")
                .and_then(Value::as_array)
                .is_some_and(|skins| skins.iter().all(valid_skin))
            && object
                .get("externalSkinPublications")
                .and_then(Value::as_array)
                .is_none_or(|links| links.iter().all(valid_link))
    });
    if is_valid {
        Ok(())
    } else {
        Err(crate::AppError::new("local_library_corrupt"))
    }
}

fn valid_item(value: &Value) -> bool {
    value.as_object().is_some_and(|item| {
        item.get("id").and_then(Value::as_u64).is_some()
            && item.get("langGroup").and_then(Value::as_u64).is_some()
            && item.get("title").and_then(Value::as_str).is_some()
            && item.get("author").and_then(Value::as_str).is_some()
    })
}

fn valid_link(value: &Value) -> bool {
    value.as_object().is_some_and(|link| {
        link.get("item").is_some_and(valid_item)
            && link.get("folderPath").and_then(Value::as_str).is_some()
    })
}

fn valid_skin(value: &Value) -> bool {
    value.as_object().is_some_and(|skin| {
        skin.get("folderName").and_then(Value::as_str).is_some()
            && skin.get("path").and_then(Value::as_str).is_some()
            && skin.get("item").is_none_or(valid_item)
            && skin.get("externalPublication").is_none_or(valid_link)
            && skin.get("fingerprint").is_none_or(valid_fingerprint)
    })
}

fn valid_fingerprint(value: &Value) -> bool {
    serde_json::from_value::<crate::skins::fingerprint::SkinFingerprint>(value.clone())
        .is_ok_and(|fingerprint| fingerprint.is_valid())
}

pub fn clear(path: &Path) -> Result<(), crate::AppError> {
    let _guard = crate::skins::install_journal::lock_local_library();
    for target in [
        path.to_path_buf(),
        path.with_extension("json.bak"),
        path.with_extension("json.corrupt"),
    ] {
        match fs::remove_file(target) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(crate::AppError::with_detail("local_library_clear_failed", error.to_string())),
        }
    }
    for journal_dir in ["skin-install-journal", "skin-external-link-journal"] {
        match fs::remove_dir_all(path.with_file_name(journal_dir)) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(crate::AppError::with_detail("local_library_clear_failed", error.to_string())),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_and_loads_library_and_keeps_previous_backup() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        let first = serde_json::json!({"favorites": [], "installedSkins": [], "externalSkinPublications": []});
        let second = serde_json::json!({"favorites": [{"id": 7, "langGroup": 8, "title": "Test", "author": "Author"}], "installedSkins": [{"availability": "present", "folderName": "OldSkin", "path": "C:/WarThunder/UserSkins/OldSkin", "fileCount": 2, "sizeBytes": 12, "installedAt": ""}], "externalSkinPublications": []});

        save(&path, &first).unwrap();
        save(&path, &second).unwrap();

        assert_eq!(load(&path).unwrap(), Some(second));
        assert_eq!(load(&path.with_extension("json.bak")).unwrap(), Some(first));
    }

    #[test]
    fn clear_removes_library_and_backup() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        save(
            &path,
            &serde_json::json!({"favorites": [], "installedSkins": []}),
        )
        .unwrap();
        save(
            &path,
            &serde_json::json!({"favorites": [{"id": 1, "langGroup": 2, "title": "Test", "author": "Author"}], "installedSkins": []}),
        )
        .unwrap();

        clear(&path).unwrap();

        assert_eq!(load(&path).unwrap(), None);
        assert_eq!(load(&path.with_extension("json.bak")).unwrap(), None);
    }

    #[test]
    fn load_recovers_backup_when_primary_is_missing_or_corrupt() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        let previous = serde_json::json!({"favorites": [{"id": 3, "langGroup": 4, "title": "Test", "author": "Author"}], "installedSkins": []});
        let backup = path.with_extension("json.bak");
        fs::write(&backup, serde_json::to_vec(&previous).unwrap()).unwrap();

        assert_eq!(load(&path).unwrap(), Some(previous.clone()));
        fs::write(&path, b"not-json").unwrap();
        assert_eq!(load(&path).unwrap(), Some(previous));
    }

    #[test]
    fn semantically_invalid_primary_recovers_valid_backup() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        let previous = serde_json::json!({"favorites": [], "installedSkins": []});
        fs::write(
            path.with_extension("json.bak"),
            serde_json::to_vec(&previous).unwrap(),
        )
        .unwrap();
        fs::write(&path, br#"{"favorites":"broken","installedSkins":[]}"#).unwrap();

        assert_eq!(load(&path).unwrap(), Some(previous));
    }

    #[test]
    fn refuses_to_replace_a_valid_file_with_invalid_library_shape() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.json");
        let existing = serde_json::json!({"favorites": [], "installedSkins": []});
        save(&path, &existing).unwrap();

        assert!(save(&path, &serde_json::json!({"favorites": "broken"})).is_err());
        assert_eq!(load(&path).unwrap(), Some(existing));
    }
}
