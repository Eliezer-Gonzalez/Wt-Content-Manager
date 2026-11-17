use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::{Path, PathBuf}, sync::{Mutex, MutexGuard}};

use crate::{local_library, AppError};

static LOCAL_LIBRARY_LOCK: Mutex<()> = Mutex::new(());
const MAX_JOURNAL_ENTRY_BYTES: u64 = 1024 * 1024;

pub(crate) fn lock_local_library() -> MutexGuard<'static, ()> {
    LOCAL_LIBRARY_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstallJournalEntry {
    transaction_id: String,
    item: Value,
    folder_name: String,
    destination: PathBuf,
    staging_root: PathBuf,
    game_root: PathBuf,
    file_count: usize,
    size_bytes: u64,
    previous_record: Option<Value>,
    replacement: bool,
    finalized: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExternalLinkEntry {
    transaction_id: String,
    item: Value,
    folder_name: String,
    folder_path: PathBuf,
    game_root: PathBuf,
    file_count: usize,
    size_bytes: u64,
}

fn journal_dir(library_path: &Path) -> PathBuf {
    library_path.with_file_name("skin-install-journal")
}

fn entry_path(library_path: &Path, id: &str) -> PathBuf {
    journal_dir(library_path).join(format!("{id}.json"))
}

fn external_journal_dir(library_path: &Path) -> PathBuf {
    library_path.with_file_name("skin-external-link-journal")
}

fn external_entry_path(library_path: &Path, id: &str) -> PathBuf {
    external_journal_dir(library_path).join(format!("{id}.json"))
}

pub(crate) fn persist_external_link(
    library_path: &Path,
    transaction_id: &str,
    item: Value,
    folder_name: &str,
    folder_path: &Path,
    game_root: &Path,
    file_count: usize,
    size_bytes: u64,
) -> Result<(), AppError> {
    validate_transaction_id(transaction_id)?;
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let entry = ExternalLinkEntry {
        transaction_id: transaction_id.to_string(), item, folder_name: folder_name.to_string(),
        folder_path: folder_path.to_path_buf(), game_root: game_root.to_path_buf(), file_count, size_bytes,
    };
    let directory = external_journal_dir(library_path);
    fs::create_dir_all(&directory).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    write_external_atomic(&external_entry_path(library_path, transaction_id), &entry)?;
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    upsert_external_link(&mut library, &entry, "present");
    local_library::save_unlocked(library_path, &library)
}

pub(crate) fn prepare(
    library_path: &Path,
    transaction_id: &str,
    item: Value,
    folder_name: &str,
    destination: &Path,
    staging_root: &Path,
    game_root: &Path,
    file_count: usize,
    size_bytes: u64,
    replacement: bool,
) -> Result<(), AppError> {
    validate_transaction_id(transaction_id)?;
    if item.get("id").and_then(Value::as_u64).is_none()
        || item.get("langGroup").and_then(Value::as_u64).is_none()
        || item.get("title").and_then(Value::as_str).is_none()
        || item.get("author").and_then(Value::as_str).is_none()
    {
        return Err(AppError::new("local_library_corrupt"));
    }
    let _guard = lock_local_library();
    let directory = journal_dir(library_path);
    fs::create_dir_all(&directory).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    let existing_library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| serde_json::json!({
        "favorites": [], "installedSkins": [], "externalSkinPublications": []
    }));
    let previous_record = existing_library.get("installedSkins").and_then(Value::as_array)
        .and_then(|skins| skins.iter().find(|skin| skin.get("path").and_then(Value::as_str).is_some_and(|path| paths_equal(path, &destination.to_string_lossy()))))
        .cloned();
    let entry = InstallJournalEntry {
        transaction_id: transaction_id.to_string(), item, folder_name: folder_name.to_string(),
        destination: destination.to_path_buf(), staging_root: staging_root.to_path_buf(),
        game_root: game_root.to_path_buf(), file_count, size_bytes, previous_record, replacement, finalized: false,
    };
    write_atomic(&entry_path(library_path, transaction_id), &entry)
}

pub(crate) fn finalize(library_path: &Path, transaction_id: &str) -> Result<(), AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let path = entry_path(library_path, transaction_id);
    let entry = read_entry(&path)?;
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| serde_json::json!({
        "favorites": [], "installedSkins": [], "externalSkinPublications": []
    }));
    if valid_entry_paths(&entry)
        && safe_directory(&entry.destination, &entry.game_root.join("UserSkins")) == Some(true)
        && safe_directory(&entry.staging_root, &entry.game_root) == Some(false)
    {
        upsert_record(&mut library, &entry, "present");
    } else {
        if valid_entry_paths(&entry) { super::register_active_staging(entry.staging_root.clone()); }
        upsert_record(&mut library, &entry, "needsReview");
        local_library::save_unlocked(library_path, &library)?;
        return Err(AppError::new("skin_recovery_required"));
    }
    local_library::save_unlocked(library_path, &library)?;
    let mut finalized = entry;
    finalized.finalized = true;
    write_atomic(&path, &finalized)?;
    Ok(())
}

pub(crate) fn discard_transaction(library_path: &Path, transaction_id: &str) -> Result<(), AppError> {
    let _guard = lock_local_library();
    match fs::remove_file(entry_path(library_path, transaction_id)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(AppError::with_detail("local_library_write_failed", error.to_string())),
    }
}

pub(crate) fn mark_needs_review(library_path: &Path, transaction_id: &str) -> Result<(), AppError> {
    let _guard = lock_local_library();
    let entry = read_entry(&entry_path(library_path, transaction_id))?;
    register_if_owned_staging(&entry);
    mark_review(library_path, &entry)
}

pub(crate) fn save_with_journal(library_path: &Path, incoming: &Value) -> Result<(), AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let directory = journal_dir(library_path);
    let mut library = incoming.clone();
    let files = list_files(&directory)?;
    let mut acknowledge = Vec::new();
    for path in files {
        if path.extension().is_none_or(|extension| extension != "json") { continue; }
        let entry = read_entry(&path)?;
        if !valid_entry_paths(&entry) {
            register_if_owned_staging(&entry);
            upsert_record(&mut library, &entry, "needsReview");
            continue;
        }
        let destination_exists = safe_directory(&entry.destination, &entry.game_root.join("UserSkins"));
        let staging_exists = safe_directory(&entry.staging_root, &entry.game_root);
        match (destination_exists, staging_exists) {
            (Some(true), Some(false)) => {
                upsert_record(&mut library, &entry, "present");
                if entry.finalized && has_record(incoming, &entry) { acknowledge.push(path); }
            }
            (Some(false), Some(true)) if !entry.replacement => {
                // An uncommitted install is intentionally not added to the user's snapshot.
            }
            _ => {
                super::register_active_staging(entry.staging_root.clone());
                upsert_record(&mut library, &entry, "needsReview");
            },
        }
    }
    let external_files = list_files(&external_journal_dir(library_path))?;
    let mut external_acknowledge = Vec::new();
    for path in external_files {
        if path.extension().is_none_or(|extension| extension != "json") { continue; }
        let entry = read_external_entry(&path)?;
        match external_folder_exists(&entry) {
            Some(true) => {
                upsert_external_link(&mut library, &entry, "present");
                if has_external_link(incoming, &entry) { external_acknowledge.push(path); }
            }
            Some(false) => upsert_external_link(&mut library, &entry, "missing"),
            None => upsert_external_link(&mut library, &entry, "needsReview"),
        }
    }
    local_library::save_unlocked(library_path, &library)?;
    for path in acknowledge {
        fs::remove_file(path).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    }
    for path in external_acknowledge {
        fs::remove_file(path).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    }
    Ok(())
}

pub(crate) fn reconcile(library_path: &Path) -> Result<(), AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let directory = journal_dir(library_path);
    let entries = list_files(&directory)?;
    for path in entries {
        if path.extension().is_none_or(|extension| extension != "json") { continue; }
        let entry = read_entry(&path)?;
        if !valid_entry_paths(&entry) {
            register_if_owned_staging(&entry);
            mark_review(library_path, &entry)?;
            continue;
        }
        let destination_exists = safe_directory(&entry.destination, &entry.game_root.join("UserSkins"));
        let staging_exists = safe_directory(&entry.staging_root, &entry.game_root);
        match (destination_exists, staging_exists) {
            (Some(true), Some(false)) => {
                let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| serde_json::json!({
                    "favorites": [], "installedSkins": [], "externalSkinPublications": []
                }));
                upsert_record(&mut library, &entry, "present");
                local_library::save_unlocked(library_path, &library)?;
                if !entry.finalized {
                    let mut finalized = entry.clone();
                    finalized.finalized = true;
                    write_atomic(&path, &finalized)?;
                }
            }
            (Some(false), Some(true)) => {
                if entry.replacement && safe_directory(&entry.staging_root.join("previous-skin"), &entry.staging_root) == Some(true) {
                    fs::rename(entry.staging_root.join("previous-skin"), &entry.destination)
                        .map_err(|error| AppError::with_detail("skin_recovery_required", error.to_string()))?;
                    if let Some(previous_record) = &entry.previous_record {
                        let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
                        restore_previous_record(&mut library, previous_record);
                        local_library::save_unlocked(library_path, &library)?;
                    }
                    fs::remove_file(&path).map_err(|error| AppError::with_detail("skin_recovery_required", error.to_string()))?;
                    if let Err(error) = fs::remove_dir_all(&entry.staging_root) {
                        super::register_active_staging(entry.staging_root.clone());
                        return Err(AppError::with_detail("skin_recovery_required", error.to_string()));
                    }
                } else if !entry.replacement {
                    fs::remove_file(&path).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
                    fs::remove_dir_all(&entry.staging_root).map_err(|error| AppError::with_detail("skin_recovery_required", error.to_string()))?;
                } else {
                    mark_review(library_path, &entry)?;
                }
            }
            _ => {
                super::register_active_staging(entry.staging_root.clone());
                mark_review(library_path, &entry)?
            },
        }
    }
    let external_files = list_files(&external_journal_dir(library_path))?;
    for path in external_files {
        if path.extension().is_none_or(|extension| extension != "json") { continue; }
        let entry = read_external_entry(&path)?;
        let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
        let availability = match external_folder_exists(&entry) { Some(true) => "present", Some(false) => "missing", None => "needsReview" };
        upsert_external_link(&mut library, &entry, availability);
        local_library::save_unlocked(library_path, &library)?;
    }
    Ok(())
}

fn empty_library() -> Value {
    serde_json::json!({ "favorites": [], "installedSkins": [], "externalSkinPublications": [] })
}

fn external_folder_exists(entry: &ExternalLinkEntry) -> Option<bool> {
    let game_root = fs::canonicalize(&entry.game_root).ok()?;
    let user_skins = fs::canonicalize(game_root.join("UserSkins")).ok()?;
    if user_skins.parent() != Some(game_root.as_path()) { return None; }
    if fs::canonicalize(entry.folder_path.parent()?).ok()?.as_path() != user_skins.as_path() { return None; }
    if entry.folder_path.file_name().and_then(|name| name.to_str()) != Some(entry.folder_name.as_str()) { return None; }
    super::library::validate_skin_folder_name(&entry.folder_name).ok()?;
    safe_directory(&entry.folder_path, &user_skins)
}

fn upsert_external_link(library: &mut Value, entry: &ExternalLinkEntry, availability: &str) {
    let path = entry.folder_path.to_string_lossy().to_string();
    if availability != "needsReview" {
        let external = serde_json::json!({ "item": entry.item, "folderPath": path, "confirmedAt": "" });
        let record = serde_json::json!({ "availability": availability, "externalPublication": external, "folderName": entry.folder_name, "path": path, "fileCount": entry.file_count, "sizeBytes": entry.size_bytes, "installedAt": "" });
        let Some(skins) = library.get_mut("installedSkins").and_then(Value::as_array_mut) else { return; };
        skins.retain(|saved| saved.get("path").and_then(Value::as_str).is_none_or(|saved_path| !paths_equal(saved_path, &path)));
        skins.insert(0, record);
        let Some(links) = library.get_mut("externalSkinPublications").and_then(Value::as_array_mut) else { return; };
        links.retain(|saved| saved.get("folderPath").and_then(Value::as_str).is_none_or(|saved_path| !paths_equal(saved_path, &path)));
        links.push(external);
    } else {
        let Some(skins) = library.get_mut("installedSkins").and_then(Value::as_array_mut) else { return; };
        if let Some(existing) = skins.iter_mut().find(|saved| saved.get("path").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path))) {
            if let Some(object) = existing.as_object_mut() { object.insert("availability".into(), Value::String("needsReview".into())); }
        } else {
            skins.insert(0, serde_json::json!({ "availability": "needsReview", "folderName": entry.folder_name, "path": path, "fileCount": entry.file_count, "sizeBytes": entry.size_bytes, "installedAt": "" }));
        }
    }
}

fn has_external_link(library: &Value, entry: &ExternalLinkEntry) -> bool {
    library.get("externalSkinPublications").and_then(Value::as_array).is_some_and(|links| links.iter().any(|link| {
        link.get("folderPath").and_then(Value::as_str).is_some_and(|path| paths_equal(path, &entry.folder_path.to_string_lossy()))
            && link.get("item").and_then(|item| item.get("id")).and_then(Value::as_u64) == entry.item.get("id").and_then(Value::as_u64)
    }))
}

fn mark_review(library_path: &Path, entry: &InstallJournalEntry) -> Result<(), AppError> {
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| serde_json::json!({
        "favorites": [], "installedSkins": [], "externalSkinPublications": []
    }));
    upsert_record(&mut library, entry, "needsReview");
    local_library::save_unlocked(library_path, &library)
}

fn restore_previous_record(library: &mut Value, previous_record: &Value) {
    let Some(path) = previous_record.get("path").and_then(Value::as_str) else { return; };
    let Some(skins) = library.get_mut("installedSkins").and_then(Value::as_array_mut) else { return; };
    skins.retain(|saved| saved.get("path").and_then(Value::as_str).is_none_or(|saved_path| !paths_equal(saved_path, path)));
    skins.insert(0, previous_record.clone());
}

fn has_record(library: &Value, entry: &InstallJournalEntry) -> bool {
    library.get("installedSkins").and_then(Value::as_array).is_some_and(|skins| skins.iter().any(|skin| {
        skin.get("path").and_then(Value::as_str).is_some_and(|path| paths_equal(path, &entry.destination.to_string_lossy()))
            && skin.get("item").and_then(|item| item.get("id")).and_then(Value::as_u64)
                == entry.item.get("id").and_then(Value::as_u64)
    }))
}

fn paths_equal(left: &str, right: &str) -> bool {
    left.replace('\\', "/").eq_ignore_ascii_case(&right.replace('\\', "/"))
}

fn valid_entry_paths(entry: &InstallJournalEntry) -> bool {
    let game_root = match fs::canonicalize(&entry.game_root) { Ok(path) => path, Err(_) => return false };
    let user_skins = game_root.join("UserSkins");
    match fs::symlink_metadata(&user_skins) { Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}, _ => return false }
    let user_skins = match fs::canonicalize(&user_skins) { Ok(path) if path.parent() == Some(game_root.as_path()) => path, _ => return false };
    let stage_name = match entry.staging_root.file_name().and_then(|name| name.to_str()) { Some(name) => name, None => return false };
    let suffix = stage_name.strip_prefix(super::STAGING_PREFIX);
    if suffix.is_none_or(|suffix| suffix.len() != super::STAGING_SUFFIX_LEN || !suffix.chars().all(|character| character.is_ascii_alphanumeric())) { return false; }
    fs::canonicalize(entry.staging_root.parent().unwrap_or(Path::new(""))).ok().as_deref() == Some(game_root.as_path())
        && fs::canonicalize(entry.destination.parent().unwrap_or(Path::new(""))).ok().as_deref() == Some(user_skins.as_path())
        && entry.destination.file_name().and_then(|name| name.to_str()) == Some(entry.folder_name.as_str())
        && super::library::validate_skin_folder_name(&entry.folder_name).is_ok()
}

fn register_if_owned_staging(entry: &InstallJournalEntry) {
    let Ok(game_root) = fs::canonicalize(&entry.game_root) else { return; };
    let Some(name) = entry.staging_root.file_name().and_then(|name| name.to_str()) else { return; };
    let Some(suffix) = name.strip_prefix(super::STAGING_PREFIX) else { return; };
    if suffix.len() != super::STAGING_SUFFIX_LEN || !suffix.chars().all(|character| character.is_ascii_alphanumeric()) { return; }
    if fs::canonicalize(entry.staging_root.parent().unwrap_or(Path::new(""))).ok().as_deref() == Some(game_root.as_path()) {
        super::register_active_staging(entry.staging_root.clone());
    }
}

fn upsert_record(library: &mut Value, entry: &InstallJournalEntry, availability: &str) {
    let Some(skins) = library.get_mut("installedSkins").and_then(Value::as_array_mut) else { return; };
    let path = entry.destination.to_string_lossy().to_string();
    let installed_at = skins.iter().find(|saved| saved.get("path").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path)))
        .and_then(|saved| saved.get("installedAt")).cloned().unwrap_or_else(|| Value::String(String::new()));
    if availability == "needsReview" {
        if let Some(existing) = skins.iter_mut().find(|saved| saved.get("path").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path))) {
            if let Some(object) = existing.as_object_mut() { object.insert("availability".into(), Value::String("needsReview".into())); }
            return;
        }
        if let Some(previous_record) = &entry.previous_record {
            let mut record = previous_record.clone();
            if let Some(object) = record.as_object_mut() { object.insert("availability".into(), Value::String("needsReview".into())); }
            skins.insert(0, record);
            return;
        }
    }
    let mut record = serde_json::json!({
        "availability": availability,
        "folderName": entry.folder_name,
        "path": path,
        "fileCount": entry.file_count,
        "sizeBytes": entry.size_bytes,
        "installedAt": installed_at,
    });
    if availability != "needsReview" {
        record.as_object_mut().unwrap().insert("item".into(), entry.item.clone());
    }
    skins.retain(|saved| saved.get("path").and_then(Value::as_str).is_none_or(|saved_path| !paths_equal(saved_path, &entry.destination.to_string_lossy())));
    skins.insert(0, record);
}

fn safe_directory(path: &Path, parent: &Path) -> Option<bool> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
            let actual_parent = fs::canonicalize(path).ok()?.parent()?.to_path_buf();
            let expected_parent = fs::canonicalize(parent).ok()?;
            Some(actual_parent == expected_parent)
        }
        Ok(_) => None,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Some(false),
        Err(_) => None,
    }
}

fn read_entry(path: &Path) -> Result<InstallJournalEntry, AppError> {
    let bytes = read_journal_bytes(path)?;
    let entry: InstallJournalEntry = serde_json::from_slice(&bytes).map_err(|error| AppError::with_detail("local_library_corrupt", error.to_string()))?;
    if path.file_stem().and_then(|stem| stem.to_str()) != Some(entry.transaction_id.as_str()) {
        return Err(AppError::new("local_library_corrupt"));
    }
    Ok(entry)
}

fn read_external_entry(path: &Path) -> Result<ExternalLinkEntry, AppError> {
    let bytes = read_journal_bytes(path)?;
    let entry: ExternalLinkEntry = serde_json::from_slice(&bytes).map_err(|error| AppError::with_detail("local_library_corrupt", error.to_string()))?;
    if path.file_stem().and_then(|stem| stem.to_str()) != Some(entry.transaction_id.as_str()) {
        return Err(AppError::new("local_library_corrupt"));
    }
    Ok(entry)
}

fn read_journal_bytes(path: &Path) -> Result<Vec<u8>, AppError> {
    let metadata = fs::metadata(path).map_err(|error| AppError::with_detail("local_library_read_failed", error.to_string()))?;
    if metadata.len() > MAX_JOURNAL_ENTRY_BYTES { return Err(AppError::new("local_library_too_large")); }
    fs::read(path).map_err(|error| AppError::with_detail("local_library_read_failed", error.to_string()))
}

fn validate_transaction_id(transaction_id: &str) -> Result<(), AppError> {
    if transaction_id.is_empty() || transaction_id.len() > 64 || !transaction_id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-') {
        Err(AppError::new("skin_install_interrupted"))
    } else { Ok(()) }
}

fn list_files(directory: &Path) -> Result<Vec<PathBuf>, AppError> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(AppError::with_detail("local_library_read_failed", error.to_string())),
    };
    entries.map(|entry| entry.map(|entry| entry.path()).map_err(|error| AppError::with_detail("local_library_read_failed", error.to_string()))).collect()
}

fn write_atomic(path: &Path, entry: &InstallJournalEntry) -> Result<(), AppError> {
    write_serializable_atomic(path, entry)
}

fn write_external_atomic(path: &Path, entry: &ExternalLinkEntry) -> Result<(), AppError> {
    write_serializable_atomic(path, entry)
}

fn write_serializable_atomic<T: Serialize>(path: &Path, entry: &T) -> Result<(), AppError> {
    let bytes = serde_json::to_vec(entry).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().unwrap())
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    use std::io::Write;
    temp.write_all(&bytes).and_then(|()| temp.as_file().sync_all())
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    temp.persist(path).map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    Ok(())
}

#[cfg(test)]
#[path = "install_journal/tests.rs"]
mod tests;
