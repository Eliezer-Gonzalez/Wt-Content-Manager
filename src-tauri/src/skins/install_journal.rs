use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use super::fingerprint::SkinFingerprint;
use crate::{local_library, AppError};

static LOCAL_LIBRARY_LOCK: Mutex<()> = Mutex::new(());
const MAX_JOURNAL_ENTRY_BYTES: u64 = 16 * 1024 * 1024;

pub(crate) fn lock_local_library() -> MutexGuard<'static, ()> {
    LOCAL_LIBRARY_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    fingerprint: Option<SkinFingerprint>,
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
        transaction_id: transaction_id.to_string(),
        item,
        folder_name: folder_name.to_string(),
        folder_path: folder_path.to_path_buf(),
        game_root: game_root.to_path_buf(),
        file_count,
        size_bytes,
    };
    let directory = external_journal_dir(library_path);
    fs::create_dir_all(&directory)
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
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
    fingerprint: Option<SkinFingerprint>,
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
    fs::create_dir_all(&directory)
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    let existing_library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| {
        serde_json::json!({
            "favorites": [], "installedSkins": [], "externalSkinPublications": []
        })
    });
    let previous_record = existing_library
        .get("installedSkins")
        .and_then(Value::as_array)
        .and_then(|skins| {
            skins.iter().find(|skin| {
                skin.get("path")
                    .and_then(Value::as_str)
                    .is_some_and(|path| paths_equal(path, &destination.to_string_lossy()))
            })
        })
        .cloned();
    let entry = InstallJournalEntry {
        transaction_id: transaction_id.to_string(),
        item,
        folder_name: folder_name.to_string(),
        destination: destination.to_path_buf(),
        staging_root: staging_root.to_path_buf(),
        game_root: game_root.to_path_buf(),
        file_count,
        size_bytes,
        previous_record,
        replacement,
        fingerprint,
        finalized: false,
    };
    write_atomic(&entry_path(library_path, transaction_id), &entry)
}

pub(crate) fn finalize(library_path: &Path, transaction_id: &str) -> Result<(), AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let path = entry_path(library_path, transaction_id);
    let entry = read_entry(&path)?;
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| {
        serde_json::json!({
            "favorites": [], "installedSkins": [], "externalSkinPublications": []
        })
    });
    if valid_entry_paths(&entry)
        && safe_directory(&entry.destination, &entry.game_root.join("UserSkins")) == Some(true)
        && safe_directory(&entry.staging_root, &entry.game_root) == Some(false)
    {
        upsert_record(&mut library, &entry, "present");
    } else {
        if valid_entry_paths(&entry) {
            super::register_active_staging(entry.staging_root.clone());
        }
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

pub(crate) fn discard_transaction(
    library_path: &Path,
    transaction_id: &str,
) -> Result<(), AppError> {
    let _guard = lock_local_library();
    match fs::remove_file(entry_path(library_path, transaction_id)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(AppError::with_detail(
            "local_library_write_failed",
            error.to_string(),
        )),
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
    save_with_journal_unlocked(library_path, incoming)
}

fn save_with_journal_unlocked(library_path: &Path, incoming: &Value) -> Result<(), AppError> {
    let saved_revision = local_library::load_unlocked(library_path)?
        .and_then(|library| library.get("repairRevision").and_then(Value::as_u64));
    if saved_revision.is_some_and(|revision| incoming.get("repairRevision").and_then(Value::as_u64).unwrap_or(0) < revision) {
        return Err(AppError::new("local_library_stale_snapshot"));
    }
    let directory = journal_dir(library_path);
    let mut library = incoming.clone();
    let files = list_files(&directory)?;
    let mut acknowledge = Vec::new();
    for path in files {
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let entry = read_entry(&path)?;
        if !valid_entry_paths(&entry) {
            register_if_owned_staging(&entry);
            upsert_record(&mut library, &entry, "needsReview");
            continue;
        }
        let destination_exists =
            safe_directory(&entry.destination, &entry.game_root.join("UserSkins"));
        let staging_exists = safe_directory(&entry.staging_root, &entry.game_root);
        match (destination_exists, staging_exists) {
            (Some(true), Some(false)) => {
                if !entry
                    .fingerprint
                    .as_ref()
                    .is_none_or(|expected| expected.matches_path(&entry.destination))
                {
                    upsert_record(&mut library, &entry, "needsReview");
                    continue;
                }
                upsert_record(&mut library, &entry, "present");
                if entry.finalized && has_record(incoming, &entry) {
                    acknowledge.push(path);
                }
            }
            (Some(false), Some(true)) if !entry.replacement => {
                // An uncommitted install is intentionally not added to the user's snapshot.
            }
            _ => {
                super::register_active_staging(entry.staging_root.clone());
                upsert_record(&mut library, &entry, "needsReview");
            }
        }
    }
    let external_files = list_files(&external_journal_dir(library_path))?;
    let mut external_acknowledge = Vec::new();
    for path in external_files {
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let entry = read_external_entry(&path)?;
        match external_folder_exists(&entry) {
            Some(true) => {
                upsert_external_link(&mut library, &entry, "present");
                if has_external_link(incoming, &entry) {
                    external_acknowledge.push(path);
                }
            }
            Some(false) => upsert_external_link(&mut library, &entry, "missing"),
            None => upsert_external_link(&mut library, &entry, "needsReview"),
        }
    }
    local_library::save_unlocked(library_path, &library)?;
    for path in acknowledge {
        fs::remove_file(path).map_err(|error| {
            AppError::with_detail("local_library_write_failed", error.to_string())
        })?;
    }
    for path in external_acknowledge {
        fs::remove_file(path).map_err(|error| {
            AppError::with_detail("local_library_write_failed", error.to_string())
        })?;
    }
    Ok(())
}

pub(crate) fn persist_repair_result(
    library_path: &Path,
    game_path: &str,
    base: &Value,
    proposed: &Value,
) -> Result<Value, AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let mut latest = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    let mut base_snapshot = base.clone();
    if let Some(records) = base_snapshot.get_mut("installedSkins").and_then(Value::as_array_mut) {
        for (index, record) in records.iter_mut().enumerate() { super::repair::ensure_record_id(record, index); }
    }
    if let Some(records) = latest.get_mut("installedSkins").and_then(Value::as_array_mut) {
        for (index, record) in records.iter_mut().enumerate() { super::repair::ensure_record_id(record, index); }
    }
    let base_skins = base_snapshot.get("installedSkins").and_then(Value::as_array).ok_or_else(|| AppError::new("local_library_corrupt"))?;
    let proposed_skins = proposed.get("installedSkins").and_then(Value::as_array).ok_or_else(|| AppError::new("local_library_corrupt"))?;
    let latest_skins = latest.get_mut("installedSkins").and_then(Value::as_array_mut).ok_or_else(|| AppError::new("local_library_corrupt"))?;
    let game_root = fs::canonicalize(game_path).map_err(|error| AppError::with_detail("skin_invalid_folder", error.to_string()))?;
    let user_skins = fs::canonicalize(game_root.join("UserSkins")).ok();
    let mut external_path_moves = Vec::new();
    for (index, before) in base_skins.iter().enumerate() {
        let Some(after) = proposed_skins.get(index) else { continue };
        if before == after { continue; }
        let Some(record_id) = before.get("recordId").and_then(Value::as_str) else { continue };
        let Some(current_index) = latest_skins.iter().position(|current| current.get("recordId").and_then(Value::as_str) == Some(record_id)) else { continue };
        let before_path = before.get("path").and_then(Value::as_str).unwrap_or_default();
        let after_path = after.get("path").and_then(Value::as_str).unwrap_or_default();
        let latest_record = &latest_skins[current_index];
        if latest_record.get("path").and_then(Value::as_str) != Some(before_path)
            || latest_record.get("fingerprint") != before.get("fingerprint")
            || latest_record.get("item").and_then(|item| item.get("id")) != before.get("item").and_then(|item| item.get("id"))
            || latest_record.get("externalPublication").and_then(|publication| publication.get("item")).and_then(|item| item.get("id")) != before.get("externalPublication").and_then(|publication| publication.get("item")).and_then(|item| item.get("id"))
        { continue; }
        if after.get("availability").and_then(Value::as_str) == Some("present") {
            let Some(expected) = after.get("fingerprint").cloned().and_then(|value| serde_json::from_value::<SkinFingerprint>(value).ok()) else { continue; };
            let Some(user_skins) = user_skins.as_ref() else { latest_skins[current_index]["availability"] = serde_json::json!("missing"); continue; };
            let Ok(actual_path) = fs::canonicalize(after_path) else { continue; };
            if actual_path.parent() != Some(user_skins.as_path()) || safe_directory(&actual_path, user_skins) != Some(true) || !expected.matches_path(&actual_path) {
                if paths_equal(before_path, after_path) {
                    latest_skins[current_index]["availability"] = serde_json::json!("needsReview");
                    continue;
                }
                return Err(AppError::new("skin_repair_candidate_changed"));
            }
        }
        if !paths_equal(before_path, after_path) {
            let expected: SkinFingerprint = serde_json::from_value(after.get("fingerprint").cloned().ok_or_else(|| AppError::new("skin_repair_candidate_changed"))?)
                .map_err(|_| AppError::new("skin_repair_candidate_changed"))?;
            if expected.origin != super::fingerprint::FingerprintOrigin::Install {
                return Err(AppError::new("skin_repair_candidate_changed"));
            }
            let user_skins = user_skins.as_ref().ok_or_else(|| AppError::new("skin_repair_candidate_changed"))?;
            let target = fs::canonicalize(after_path).map_err(|_| AppError::new("skin_repair_candidate_changed"))?;
            if target.parent() != Some(user_skins.as_path()) || safe_directory(&target, user_skins) != Some(true) || !expected.matches_path(&target) {
                return Err(AppError::new("skin_repair_candidate_changed"));
            }
            if latest_skins.iter().enumerate().any(|(other_index, current)| other_index != current_index && current.get("path").and_then(Value::as_str).is_some_and(|path| paths_equal(path, after_path)) && (current.get("item").is_some() || current.get("externalPublication").is_some() || current.get("fingerprint").is_some())) {
                return Err(AppError::new("skin_repair_folder_claimed"));
            }
            // A bare scan placeholder has no publication identity; consume it when the verified link is committed.
            latest_skins.retain(|current| current.get("recordId").and_then(Value::as_str) == Some(record_id) || !current.get("path").and_then(Value::as_str).is_some_and(|path| paths_equal(path, after_path)) || current.get("item").is_some() || current.get("externalPublication").is_some() || current.get("fingerprint").is_some());
        }
        let Some(current) = latest_skins.iter_mut().find(|current| current.get("recordId").and_then(Value::as_str) == Some(record_id)) else { continue };
        for field in ["availability", "folderName", "path", "fingerprint"] {
            if before.get(field) != after.get(field) {
                match after.get(field) {
                    Some(value) => { current[field] = value.clone(); }
                    None => { if let Some(object) = current.as_object_mut() { object.remove(field); } }
                }
            }
        }
        if !paths_equal(before_path, after_path) {
            if let Some(mut publication) = current.get("externalPublication").cloned() {
                publication["folderPath"] = serde_json::json!(after_path);
                current["externalPublication"] = publication.clone();
                external_path_moves.push((before_path.to_string(), after_path.to_string(), publication));
            }
        }
    }
    if !external_path_moves.is_empty() {
        if !latest["externalSkinPublications"].is_array() { latest["externalSkinPublications"] = serde_json::json!([]); }
        let links = latest["externalSkinPublications"].as_array_mut().unwrap();
        for (before_path, after_path, publication) in external_path_moves {
            let mut found = false;
            for link in links.iter_mut() {
                if link.get("folderPath").and_then(Value::as_str).is_some_and(|path| paths_equal(path, &before_path) || paths_equal(path, &after_path)) {
                    *link = publication.clone();
                    found = true;
                }
            }
            if !found { links.push(publication); }
        }
    }
    let revision = latest.get("repairRevision").and_then(Value::as_u64).unwrap_or(0).saturating_add(1);
    latest["repairRevision"] = serde_json::json!(revision);
    save_with_journal_unlocked(library_path, &latest)?;
    Ok(latest)
}

pub(crate) fn confirm_repair_candidate(
    library_path: &Path,
    game_path: &str,
    candidate: &super::repair::RepairCandidate,
) -> Result<Value, AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    super::repair::confirm_candidate(&mut library, candidate, game_path)?;
    let revision = library.get("repairRevision").and_then(Value::as_u64).unwrap_or(0).saturating_add(1);
    library["repairRevision"] = serde_json::json!(revision);
    save_with_journal_unlocked(library_path, &library)?;
    Ok(library)
}

pub(crate) fn persist_import_result(
    library_path: &Path,
    game_path: &str,
    _base: &Value,
    proposed: &Value,
    imported_skins: &[Value],
    control: &super::repair::RepairTaskControl,
    mut progress: impl FnMut(super::repair::RepairProgress),
) -> Result<Value, AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let game_root = fs::canonicalize(game_path).map_err(|error| AppError::with_detail("skin_invalid_folder", error.to_string()))?;
    let user_skins = fs::canonicalize(game_root.join("UserSkins")).map_err(|error| AppError::with_detail("skin_invalid_folder", error.to_string()))?;
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    let mut auto_linked = 0usize;
    let mut external_updates = Vec::new();

    if let (Some(imported_favorites), Some(saved_favorites)) = (proposed.get("favorites").and_then(Value::as_array), library.get_mut("favorites").and_then(Value::as_array_mut)) {
        for item in imported_favorites {
            let identity = (item.get("id").and_then(Value::as_u64), item.get("contentType").and_then(Value::as_str));
            if !saved_favorites.iter().any(|saved| (saved.get("id").and_then(Value::as_u64), saved.get("contentType").and_then(Value::as_str)) == identity) {
                saved_favorites.push(item.clone());
            }
        }
    }
    let external_claims: std::collections::HashSet<String> = library.get("externalSkinPublications").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|link| link.get("folderPath").and_then(Value::as_str).map(normalize_filesystem_path)).collect();
    let skins = library.get_mut("installedSkins").and_then(Value::as_array_mut).ok_or_else(|| AppError::new("local_library_corrupt"))?;
    let mut targets = Vec::new();
    let total = skins.iter().filter(|record| record.get("availability").and_then(Value::as_str) == Some("present") && record.get("item").is_none() && record.get("externalPublication").is_none())
        .filter_map(|record| record.get("path").and_then(Value::as_str))
        .filter(|path| Path::new(path).exists() && !external_claims.contains(&normalize_filesystem_path(path))).count();
    let mut hash_completed = 0usize;
    for (index, record) in skins.iter_mut().enumerate() {
        if control.is_cancelled() { return Err(AppError::new("download_cancelled")); }
        super::repair::ensure_record_id(record, index);
        if record.get("availability").and_then(Value::as_str) != Some("present") || record.get("item").is_some() || record.get("externalPublication").is_some() { continue; }
        let path = record.get("path").and_then(Value::as_str).unwrap_or_default();
        if external_claims.contains(&normalize_filesystem_path(path)) { continue; }
        let metadata = match fs::symlink_metadata(path) { Ok(value) => value, Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue, Err(error) => return Err(AppError::with_detail("skin_repair_hash_failed", error.to_string())) };
        if metadata.file_type().is_symlink() || super::fingerprint::is_reparse_point(&metadata) { return Err(AppError::new("skin_repair_hash_failed")); }
        let target = fs::canonicalize(path).map_err(|error| AppError::with_detail("skin_repair_hash_failed", error.to_string()))?;
        if target.parent() != Some(user_skins.as_path()) || safe_directory(&target, &user_skins) != Some(true) { return Err(AppError::new("skin_repair_hash_failed")); }
        let folder = record.get("folderName").and_then(Value::as_str).unwrap_or_default().to_string();
        let mut last_reported_bytes = 0_u64;
        progress(super::repair::RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
        let fingerprint = SkinFingerprint::compute_controlled(&target, |bytes| {
            if bytes.saturating_sub(last_reported_bytes) >= 4 * 1024 * 1024 {
                last_reported_bytes = bytes;
                progress(super::repair::RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
            }
            !control.is_cancelled()
        }).map_err(|error| if control.is_cancelled() || error.kind() == std::io::ErrorKind::Interrupted { AppError::new("download_cancelled") } else { AppError::with_detail("skin_repair_hash_failed", error.to_string()) })?;
        hash_completed += 1;
        progress(super::repair::RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
        targets.push((index, record["recordId"].as_str().unwrap_or_default().to_string(), path.to_string(), record.get("folderName").and_then(Value::as_str).unwrap_or_default().to_string(), fingerprint));
    }
    let mut sources = Vec::new();
    for entry in imported_skins {
        let item = entry.get("item").filter(|item| valid_item_for_repair(item)).cloned();
        let external = entry.get("externalPublication").filter(|publication| publication.get("item").is_some_and(valid_item_for_repair)).cloned();
        if item.is_none() && external.is_none() { continue; }
        let fingerprint = entry.get("fingerprint").cloned().and_then(|value| serde_json::from_value::<SkinFingerprint>(value).ok()).filter(|fp| fp.origin == super::fingerprint::FingerprintOrigin::Install && fp.is_valid());
        sources.push((entry.get("folderName").and_then(Value::as_str).unwrap_or_default().to_string(), fingerprint, item, external));
    }
    let mut full_edges = vec![vec![]; sources.len()];
    let mut partial_edges = vec![vec![]; sources.len()];
    let mut folder_degrees = vec![0usize; targets.len()];
    for (source_index, source) in sources.iter().enumerate() {
        let Some(expected) = source.1.as_ref() else { continue };
        for (target_index, target) in targets.iter().enumerate() {
            let evidence = import_overlap(expected, &target.4);
            if expected.content_matches(&target.4) { full_edges[source_index].push(target_index); }
            if evidence.0 > 0 { partial_edges[source_index].push((target_index, evidence)); folder_degrees[target_index] += 1; }
        }
    }
    for source in &sources {
        if source.1.is_none() {
            for (target_index, target) in targets.iter().enumerate() {
                if target.3.eq_ignore_ascii_case(&source.0) { folder_degrees[target_index] += 1; }
            }
        }
    }
    let mut matched_targets = std::collections::HashSet::new();
    for (source_index, edges) in full_edges.iter().enumerate() {
        if edges.len() != 1 || partial_edges[source_index].len() != 1 || folder_degrees[edges[0]] != 1 { continue; }
        let target_index = edges[0];
        let (record_index, _record_id, path, _name, fingerprint) = &targets[target_index];
        let claim_count = skins.iter().filter(|record| record.get("path").and_then(Value::as_str).is_some_and(|saved| paths_equal(saved, path))).count();
        if claim_count != 1 || skins[*record_index].get("item").is_some() || skins[*record_index].get("externalPublication").is_some() { continue; }
        if let Some(item) = &sources[source_index].2 { skins[*record_index]["item"] = item.clone(); }
        if let Some(mut publication) = sources[source_index].3.clone() {
            publication["folderPath"] = Value::String(path.clone());
            skins[*record_index]["externalPublication"] = publication.clone();
            external_updates.push((path.clone(), publication));
        }
        skins[*record_index]["fingerprint"] = serde_json::to_value(fingerprint).map_err(|_| AppError::new("local_library_corrupt"))?;
        matched_targets.insert(target_index);
        auto_linked += 1;
    }
    let mut candidates = Vec::new();
    for (source_index, source) in sources.iter().enumerate() {
        if let Some(expected) = source.1.as_ref() {
            for (target_index, (matching_files, matching_bytes)) in &partial_edges[source_index] {
                if matched_targets.contains(target_index) { continue; }
                let (_, record_id, path, _, actual) = &targets[*target_index];
                candidates.push(make_import_candidate(record_id, path, expected, actual, source.2.clone(), source.3.clone()));
                if let Some(candidate) = candidates.last_mut() { if expected.content_matches(actual) { candidate.reason = "ambiguousFull".into(); } let _ = (matching_files, matching_bytes); }
            }
        } else {
            for (_, record_id, path, name, actual) in &targets {
                if !name.eq_ignore_ascii_case(&source.0) { continue; }
                let baseline = actual.clone().as_baseline();
                let mut candidate = make_import_candidate(record_id, path, &baseline, actual, source.2.clone(), source.3.clone());
                candidate.reason = "nameOnly".into(); candidate.match_percent = 0; candidate.matching_files = 0; candidate.total_files = 0; candidate.matching_bytes = 0; candidate.total_bytes = 0; candidate.source_fingerprint = None;
                candidates.push(candidate);
            }
        }
    }
    if !external_updates.is_empty() {
        if !library["externalSkinPublications"].is_array() { library["externalSkinPublications"] = serde_json::json!([]); }
        let links = library["externalSkinPublications"].as_array_mut().unwrap();
        for (path, publication) in external_updates {
            links.retain(|saved| !saved.get("folderPath").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path)));
            links.push(publication);
        }
    }
    if control.is_cancelled() { return Err(AppError::new("download_cancelled")); }
    control.begin_finalizing()?;
    progress(super::repair::RepairProgress { phase: "finalizing", completed: 1, total: 1, current: String::new() });
    let revision = library.get("repairRevision").and_then(Value::as_u64).unwrap_or(0).saturating_add(1);
    library["repairRevision"] = serde_json::json!(revision);
    save_with_journal_unlocked(library_path, &library)?;
    Ok(serde_json::json!({"library": library, "candidates": candidates, "autoLinked": auto_linked}))
}

fn valid_item_for_repair(value: &Value) -> bool {
    value.get("id").and_then(Value::as_u64).is_some() && value.get("langGroup").and_then(Value::as_u64).is_some()
        && value.get("title").and_then(Value::as_str).is_some() && value.get("author").and_then(Value::as_str).is_some()
}

fn import_overlap(saved: &SkinFingerprint, current: &SkinFingerprint) -> (usize, u64) {
    let current_files: std::collections::HashMap<&str, _> = current.files.iter().map(|file| (file.relative_path.as_str(), file)).collect();
    saved.files.iter().filter_map(|file| current_files.get(file.relative_path.as_str()).filter(|other| other.size_bytes == file.size_bytes && other.hash == file.hash).map(|_| (1usize, file.size_bytes))).fold((0usize, 0u64), |(count, bytes), (file_count, file_bytes)| (count + file_count, bytes.saturating_add(file_bytes)))
}

fn make_import_candidate(record_id: &str, path: &str, expected: &SkinFingerprint, actual: &SkinFingerprint, item: Option<Value>, external: Option<Value>) -> super::repair::RepairCandidate {
    let current: std::collections::HashMap<&str, _> = actual.files.iter().map(|file| (file.relative_path.as_str(), file)).collect();
    let (matching_files, matching_bytes) = expected.files.iter().filter_map(|file| current.get(file.relative_path.as_str()).filter(|other| other.size_bytes == file.size_bytes && other.hash == file.hash).map(|_| (1usize, file.size_bytes))).fold((0usize, 0u64), |(count, bytes), (file_count, file_bytes)| (count + file_count, bytes.saturating_add(file_bytes)));
    let total_files = expected.files.len().max(actual.files.len());
    let expected_bytes = expected.files.iter().fold(0u64, |sum, file| sum.saturating_add(file.size_bytes));
    let actual_bytes = actual.files.iter().fold(0u64, |sum, file| sum.saturating_add(file.size_bytes));
    let total_bytes = expected_bytes.max(actual_bytes);
    let file_ratio = matching_files as f64 / total_files.max(1) as f64;
    let byte_ratio = if total_bytes == 0 { file_ratio } else { matching_bytes as f64 / total_bytes as f64 };
    super::repair::RepairCandidate { record_id: record_id.to_string(), record_path: path.to_string(), folder_name: Path::new(path).file_name().and_then(|name| name.to_str()).unwrap_or_default().to_string(), folder_path: path.to_string(), matching_files, total_files, matching_bytes, total_bytes, match_percent: (((file_ratio + byte_ratio) / 2.0) * 100.0).round() as u8, reason: if expected.content_matches(actual) { "ambiguousFull".into() } else { "partial".into() }, source_fingerprint: Some(expected.clone()), item, external_publication: external }
}

pub(crate) fn reconcile(library_path: &Path) -> Result<(), AppError> {
    let _game_guard = super::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let directory = journal_dir(library_path);
    let entries = list_files(&directory)?;
    for path in entries {
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let entry = read_entry(&path)?;
        if !valid_entry_paths(&entry) {
            register_if_owned_staging(&entry);
            mark_review(library_path, &entry)?;
            continue;
        }
        let destination_exists =
            safe_directory(&entry.destination, &entry.game_root.join("UserSkins"));
        let staging_exists = safe_directory(&entry.staging_root, &entry.game_root);
        match (destination_exists, staging_exists) {
            (Some(true), Some(false)) => {
                if !entry
                    .fingerprint
                    .as_ref()
                    .is_none_or(|expected| expected.matches_path(&entry.destination))
                {
                    mark_review(library_path, &entry)?;
                    continue;
                }
                let mut library =
                    local_library::load_unlocked(library_path)?.unwrap_or_else(|| {
                        serde_json::json!({
                            "favorites": [], "installedSkins": [], "externalSkinPublications": []
                        })
                    });
                upsert_record(&mut library, &entry, "present");
                local_library::save_unlocked(library_path, &library)?;
                if !entry.finalized {
                    let mut finalized = entry.clone();
                    finalized.finalized = true;
                    write_atomic(&path, &finalized)?;
                }
            }
            (Some(false), Some(true)) => {
                if entry.replacement
                    && safe_directory(
                        &entry.staging_root.join("previous-skin"),
                        &entry.staging_root,
                    ) == Some(true)
                {
                    fs::rename(entry.staging_root.join("previous-skin"), &entry.destination)
                        .map_err(|error| {
                            AppError::with_detail("skin_recovery_required", error.to_string())
                        })?;
                    if let Some(previous_record) = &entry.previous_record {
                        let mut library = local_library::load_unlocked(library_path)?
                            .unwrap_or_else(empty_library);
                        restore_previous_record(&mut library, previous_record);
                        local_library::save_unlocked(library_path, &library)?;
                    }
                    fs::remove_file(&path).map_err(|error| {
                        AppError::with_detail("skin_recovery_required", error.to_string())
                    })?;
                    if let Err(error) = fs::remove_dir_all(&entry.staging_root) {
                        super::register_active_staging(entry.staging_root.clone());
                        return Err(AppError::with_detail(
                            "skin_recovery_required",
                            error.to_string(),
                        ));
                    }
                } else if !entry.replacement {
                    fs::remove_file(&path).map_err(|error| {
                        AppError::with_detail("local_library_write_failed", error.to_string())
                    })?;
                    fs::remove_dir_all(&entry.staging_root).map_err(|error| {
                        AppError::with_detail("skin_recovery_required", error.to_string())
                    })?;
                } else {
                    mark_review(library_path, &entry)?;
                }
            }
            _ => {
                super::register_active_staging(entry.staging_root.clone());
                mark_review(library_path, &entry)?
            }
        }
    }
    let external_files = list_files(&external_journal_dir(library_path))?;
    for path in external_files {
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let entry = read_external_entry(&path)?;
        let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
        let availability = match external_folder_exists(&entry) {
            Some(true) => "present",
            Some(false) => "missing",
            None => "needsReview",
        };
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
    if user_skins.parent() != Some(game_root.as_path()) {
        return None;
    }
    if fs::canonicalize(entry.folder_path.parent()?)
        .ok()?
        .as_path()
        != user_skins.as_path()
    {
        return None;
    }
    if entry.folder_path.file_name().and_then(|name| name.to_str())
        != Some(entry.folder_name.as_str())
    {
        return None;
    }
    super::library::validate_skin_folder_name(&entry.folder_name).ok()?;
    safe_directory(&entry.folder_path, &user_skins)
}

fn upsert_external_link(library: &mut Value, entry: &ExternalLinkEntry, availability: &str) {
    let path = entry.folder_path.to_string_lossy().to_string();
    if availability != "needsReview" {
        let external =
            serde_json::json!({ "item": entry.item, "folderPath": path, "confirmedAt": "" });
        let Some(skins) = library
            .get_mut("installedSkins")
            .and_then(Value::as_array_mut)
        else {
            return;
        };
        let record_id = skins.iter().find(|saved| saved.get("path").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path)))
            .and_then(|saved| saved.get("recordId")).cloned()
            .unwrap_or_else(|| Value::String(format!("external-{}", entry.transaction_id)));
        let record = serde_json::json!({ "recordId": record_id, "availability": availability, "externalPublication": external, "folderName": entry.folder_name, "path": path, "fileCount": entry.file_count, "sizeBytes": entry.size_bytes, "installedAt": "" });
        skins.retain(|saved| {
            saved
                .get("path")
                .and_then(Value::as_str)
                .is_none_or(|saved_path| !paths_equal(saved_path, &path))
        });
        skins.insert(0, record);
        let Some(links) = library
            .get_mut("externalSkinPublications")
            .and_then(Value::as_array_mut)
        else {
            return;
        };
        links.retain(|saved| {
            saved
                .get("folderPath")
                .and_then(Value::as_str)
                .is_none_or(|saved_path| !paths_equal(saved_path, &path))
        });
        links.push(external);
    } else {
        let Some(skins) = library
            .get_mut("installedSkins")
            .and_then(Value::as_array_mut)
        else {
            return;
        };
        if let Some(existing) = skins.iter_mut().find(|saved| {
            saved
                .get("path")
                .and_then(Value::as_str)
                .is_some_and(|saved_path| paths_equal(saved_path, &path))
        }) {
            if let Some(object) = existing.as_object_mut() {
                object.insert("availability".into(), Value::String("needsReview".into()));
            }
        } else {
            skins.insert(0, serde_json::json!({ "availability": "needsReview", "folderName": entry.folder_name, "path": path, "fileCount": entry.file_count, "sizeBytes": entry.size_bytes, "installedAt": "" }));
        }
    }
}

fn has_external_link(library: &Value, entry: &ExternalLinkEntry) -> bool {
    library
        .get("externalSkinPublications")
        .and_then(Value::as_array)
        .is_some_and(|links| {
            links.iter().any(|link| {
                link.get("folderPath")
                    .and_then(Value::as_str)
                    .is_some_and(|path| paths_equal(path, &entry.folder_path.to_string_lossy()))
                    && link
                        .get("item")
                        .and_then(|item| item.get("id"))
                        .and_then(Value::as_u64)
                        == entry.item.get("id").and_then(Value::as_u64)
            })
        })
}

fn mark_review(library_path: &Path, entry: &InstallJournalEntry) -> Result<(), AppError> {
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(|| {
        serde_json::json!({
            "favorites": [], "installedSkins": [], "externalSkinPublications": []
        })
    });
    upsert_record(&mut library, entry, "needsReview");
    local_library::save_unlocked(library_path, &library)
}

fn restore_previous_record(library: &mut Value, previous_record: &Value) {
    let Some(path) = previous_record.get("path").and_then(Value::as_str) else {
        return;
    };
    let Some(skins) = library
        .get_mut("installedSkins")
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    skins.retain(|saved| {
        saved
            .get("path")
            .and_then(Value::as_str)
            .is_none_or(|saved_path| !paths_equal(saved_path, path))
    });
    skins.insert(0, previous_record.clone());
}

fn has_record(library: &Value, entry: &InstallJournalEntry) -> bool {
    library
        .get("installedSkins")
        .and_then(Value::as_array)
        .is_some_and(|skins| {
            skins.iter().any(|skin| {
                let same_identity = skin.get("path")
                    .and_then(Value::as_str)
                    .is_some_and(|path| paths_equal(path, &entry.destination.to_string_lossy()))
                    && skin
                        .get("item")
                        .and_then(|item| item.get("id"))
                        .and_then(Value::as_u64)
                        == entry.item.get("id").and_then(Value::as_u64);
                let same_fingerprint = entry.fingerprint.as_ref().is_none_or(|expected| {
                    skin.get("fingerprint")
                        .and_then(|value| serde_json::from_value::<SkinFingerprint>(value.clone()).ok())
                        .is_some_and(|actual| actual == *expected)
                });
                same_identity && same_fingerprint
            })
        })
}

fn paths_equal(left: &str, right: &str) -> bool {
    normalize_filesystem_path(left) == normalize_filesystem_path(right)
}

fn normalize_filesystem_path(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    if normalized.to_lowercase().starts_with("//?/unc/") {
        normalized = format!("//{}", &normalized[8..]);
    } else if normalized.starts_with("//?/") {
        normalized = normalized[4..].to_string();
    }
    normalized.trim_end_matches('/').to_lowercase()
}

fn valid_entry_paths(entry: &InstallJournalEntry) -> bool {
    let game_root = match fs::canonicalize(&entry.game_root) {
        Ok(path) => path,
        Err(_) => return false,
    };
    let user_skins = game_root.join("UserSkins");
    match fs::symlink_metadata(&user_skins) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
        _ => return false,
    }
    let user_skins = match fs::canonicalize(&user_skins) {
        Ok(path) if path.parent() == Some(game_root.as_path()) => path,
        _ => return false,
    };
    let stage_name = match entry
        .staging_root
        .file_name()
        .and_then(|name| name.to_str())
    {
        Some(name) => name,
        None => return false,
    };
    let suffix = stage_name.strip_prefix(super::STAGING_PREFIX);
    if suffix.is_none_or(|suffix| {
        suffix.len() != super::STAGING_SUFFIX_LEN
            || !suffix
                .chars()
                .all(|character| character.is_ascii_alphanumeric())
    }) {
        return false;
    }
    fs::canonicalize(entry.staging_root.parent().unwrap_or(Path::new("")))
        .ok()
        .as_deref()
        == Some(game_root.as_path())
        && fs::canonicalize(entry.destination.parent().unwrap_or(Path::new("")))
            .ok()
            .as_deref()
            == Some(user_skins.as_path())
        && entry.destination.file_name().and_then(|name| name.to_str())
            == Some(entry.folder_name.as_str())
        && super::library::validate_skin_folder_name(&entry.folder_name).is_ok()
}

fn register_if_owned_staging(entry: &InstallJournalEntry) {
    let Ok(game_root) = fs::canonicalize(&entry.game_root) else {
        return;
    };
    let Some(name) = entry
        .staging_root
        .file_name()
        .and_then(|name| name.to_str())
    else {
        return;
    };
    let Some(suffix) = name.strip_prefix(super::STAGING_PREFIX) else {
        return;
    };
    if suffix.len() != super::STAGING_SUFFIX_LEN
        || !suffix
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return;
    }
    if fs::canonicalize(entry.staging_root.parent().unwrap_or(Path::new("")))
        .ok()
        .as_deref()
        == Some(game_root.as_path())
    {
        super::register_active_staging(entry.staging_root.clone());
    }
}

fn upsert_record(library: &mut Value, entry: &InstallJournalEntry, availability: &str) {
    let Some(skins) = library
        .get_mut("installedSkins")
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    let path = entry.destination.to_string_lossy().to_string();
    let installed_at = skins
        .iter()
        .find(|saved| {
            saved
                .get("path")
                .and_then(Value::as_str)
                .is_some_and(|saved_path| paths_equal(saved_path, &path))
        })
        .and_then(|saved| saved.get("installedAt"))
        .cloned()
        .unwrap_or_else(|| Value::String(String::new()));
    let record_id = skins.iter().find(|saved| saved.get("path").and_then(Value::as_str).is_some_and(|saved_path| paths_equal(saved_path, &path)))
        .and_then(|saved| saved.get("recordId")).cloned()
        .or_else(|| entry.previous_record.as_ref().and_then(|saved| saved.get("recordId")).cloned())
        .unwrap_or_else(|| Value::String(format!("install-{}", entry.transaction_id)));
    if availability == "needsReview" {
        if let Some(existing) = skins.iter_mut().find(|saved| {
            saved
                .get("path")
                .and_then(Value::as_str)
                .is_some_and(|saved_path| paths_equal(saved_path, &path))
        }) {
            if let Some(object) = existing.as_object_mut() {
                object.insert("availability".into(), Value::String("needsReview".into()));
            }
            return;
        }
        if let Some(previous_record) = &entry.previous_record {
            let mut record = previous_record.clone();
            if let Some(object) = record.as_object_mut() {
                object.insert("availability".into(), Value::String("needsReview".into()));
            }
            skins.insert(0, record);
            return;
        }
    }
    let mut record = serde_json::json!({
        "recordId": record_id,
        "availability": availability,
        "folderName": entry.folder_name,
        "path": path,
        "fileCount": entry.file_count,
        "sizeBytes": entry.size_bytes,
        "installedAt": installed_at,
    });
    if availability != "needsReview" {
        record
            .as_object_mut()
            .unwrap()
            .insert("item".into(), entry.item.clone());
        if let Some(fingerprint) = &entry.fingerprint {
            record.as_object_mut().unwrap().insert(
                "fingerprint".into(),
                serde_json::to_value(fingerprint).expect("fingerprint serialization is infallible"),
            );
        }
    }
    skins.retain(|saved| {
        saved
            .get("path")
            .and_then(Value::as_str)
            .is_none_or(|saved_path| !paths_equal(saved_path, &entry.destination.to_string_lossy()))
    });
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
    let entry: InstallJournalEntry = serde_json::from_slice(&bytes)
        .map_err(|error| AppError::with_detail("local_library_corrupt", error.to_string()))?;
    if path.file_stem().and_then(|stem| stem.to_str()) != Some(entry.transaction_id.as_str()) {
        return Err(AppError::new("local_library_corrupt"));
    }
    Ok(entry)
}

fn read_external_entry(path: &Path) -> Result<ExternalLinkEntry, AppError> {
    let bytes = read_journal_bytes(path)?;
    let entry: ExternalLinkEntry = serde_json::from_slice(&bytes)
        .map_err(|error| AppError::with_detail("local_library_corrupt", error.to_string()))?;
    if path.file_stem().and_then(|stem| stem.to_str()) != Some(entry.transaction_id.as_str()) {
        return Err(AppError::new("local_library_corrupt"));
    }
    Ok(entry)
}

fn read_journal_bytes(path: &Path) -> Result<Vec<u8>, AppError> {
    let metadata = fs::metadata(path)
        .map_err(|error| AppError::with_detail("local_library_read_failed", error.to_string()))?;
    if metadata.len() > MAX_JOURNAL_ENTRY_BYTES {
        return Err(AppError::new("local_library_too_large"));
    }
    fs::read(path)
        .map_err(|error| AppError::with_detail("local_library_read_failed", error.to_string()))
}

fn validate_transaction_id(transaction_id: &str) -> Result<(), AppError> {
    if transaction_id.is_empty()
        || transaction_id.len() > 64
        || !transaction_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        Err(AppError::new("skin_install_interrupted"))
    } else {
        Ok(())
    }
}

fn list_files(directory: &Path) -> Result<Vec<PathBuf>, AppError> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(AppError::with_detail(
                "local_library_read_failed",
                error.to_string(),
            ))
        }
    };
    entries
        .map(|entry| {
            entry.map(|entry| entry.path()).map_err(|error| {
                AppError::with_detail("local_library_read_failed", error.to_string())
            })
        })
        .collect()
}

fn write_atomic(path: &Path, entry: &InstallJournalEntry) -> Result<(), AppError> {
    write_serializable_atomic(path, entry)
}

fn write_external_atomic(path: &Path, entry: &ExternalLinkEntry) -> Result<(), AppError> {
    write_serializable_atomic(path, entry)
}

fn write_serializable_atomic<T: Serialize>(path: &Path, entry: &T) -> Result<(), AppError> {
    let bytes = serde_json::to_vec(entry)
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().unwrap())
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    use std::io::Write;
    temp.write_all(&bytes)
        .and_then(|()| temp.as_file().sync_all())
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    temp.persist(path)
        .map_err(|error| AppError::with_detail("local_library_write_failed", error.to_string()))?;
    Ok(())
}

#[cfg(test)]
#[path = "install_journal/tests.rs"]
mod tests;
