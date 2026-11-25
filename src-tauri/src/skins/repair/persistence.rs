use serde_json::Value;
use std::fs;
use std::path::Path;

use super::{RepairCandidate, RepairProgress, RepairTaskControl};
use crate::{
    local_library,
    skins::{
        fingerprint::SkinFingerprint,
        install_journal::{
            empty_library, lock_local_library, normalize_filesystem_path, paths_equal,
            safe_directory, save_with_journal_unlocked,
        },
    },
    AppError,
};
pub(crate) fn persist_repair_result(
    library_path: &Path,
    game_path: &str,
    base: &Value,
    proposed: &Value,
) -> Result<Value, AppError> {
    let _game_guard = crate::skins::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let mut latest = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    let mut base_snapshot = base.clone();
    if let Some(records) = base_snapshot.get_mut("installedSkins").and_then(Value::as_array_mut) {
        for (index, record) in records.iter_mut().enumerate() { super::ensure_record_id(record, index); }
    }
    if let Some(records) = latest.get_mut("installedSkins").and_then(Value::as_array_mut) {
        for (index, record) in records.iter_mut().enumerate() { super::ensure_record_id(record, index); }
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
            if expected.origin != crate::skins::fingerprint::FingerprintOrigin::Install {
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
    candidate: &RepairCandidate,
) -> Result<Value, AppError> {
    let _game_guard = crate::skins::recovery::lock_game_filesystem();
    let _guard = lock_local_library();
    let mut library = local_library::load_unlocked(library_path)?.unwrap_or_else(empty_library);
    super::matching::confirm_candidate(&mut library, candidate, game_path)?;
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
    control: &RepairTaskControl,
    mut progress: impl FnMut(RepairProgress),
) -> Result<Value, AppError> {
    let _game_guard = crate::skins::recovery::lock_game_filesystem();
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
        super::ensure_record_id(record, index);
        if record.get("availability").and_then(Value::as_str) != Some("present") || record.get("item").is_some() || record.get("externalPublication").is_some() { continue; }
        let path = record.get("path").and_then(Value::as_str).unwrap_or_default();
        if external_claims.contains(&normalize_filesystem_path(path)) { continue; }
        let metadata = match fs::symlink_metadata(path) { Ok(value) => value, Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue, Err(error) => return Err(AppError::with_detail("skin_repair_hash_failed", error.to_string())) };
        if metadata.file_type().is_symlink() || crate::skins::fingerprint::is_reparse_point(&metadata) { return Err(AppError::new("skin_repair_hash_failed")); }
        let target = fs::canonicalize(path).map_err(|error| AppError::with_detail("skin_repair_hash_failed", error.to_string()))?;
        if target.parent() != Some(user_skins.as_path()) || safe_directory(&target, &user_skins) != Some(true) { return Err(AppError::new("skin_repair_hash_failed")); }
        let folder = record.get("folderName").and_then(Value::as_str).unwrap_or_default().to_string();
        let mut last_reported_bytes = 0_u64;
        progress(RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
        let fingerprint = SkinFingerprint::compute_controlled(&target, |bytes| {
            if bytes.saturating_sub(last_reported_bytes) >= 4 * 1024 * 1024 {
                last_reported_bytes = bytes;
                progress(RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
            }
            !control.is_cancelled()
        }).map_err(|error| if control.is_cancelled() || error.kind() == std::io::ErrorKind::Interrupted { AppError::new("download_cancelled") } else { AppError::with_detail("skin_repair_hash_failed", error.to_string()) })?;
        hash_completed += 1;
        progress(RepairProgress { phase: "hashing", completed: hash_completed, total, current: folder.clone() });
        targets.push((index, record["recordId"].as_str().unwrap_or_default().to_string(), path.to_string(), record.get("folderName").and_then(Value::as_str).unwrap_or_default().to_string(), fingerprint));
    }
    let mut sources = Vec::new();
    for entry in imported_skins {
        let item = entry.get("item").filter(|item| valid_item_for_repair(item)).cloned();
        let external = entry.get("externalPublication").filter(|publication| publication.get("item").is_some_and(valid_item_for_repair)).cloned();
        if item.is_none() && external.is_none() { continue; }
        let fingerprint = entry.get("fingerprint").cloned().and_then(|value| serde_json::from_value::<SkinFingerprint>(value).ok()).filter(|fp| fp.origin == crate::skins::fingerprint::FingerprintOrigin::Install && fp.is_valid());
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
    progress(RepairProgress { phase: "finalizing", completed: 1, total: 1, current: String::new() });
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

fn make_import_candidate(record_id: &str, path: &str, expected: &SkinFingerprint, actual: &SkinFingerprint, item: Option<Value>, external: Option<Value>) -> RepairCandidate {
    let current: std::collections::HashMap<&str, _> = actual.files.iter().map(|file| (file.relative_path.as_str(), file)).collect();
    let (matching_files, matching_bytes) = expected.files.iter().filter_map(|file| current.get(file.relative_path.as_str()).filter(|other| other.size_bytes == file.size_bytes && other.hash == file.hash).map(|_| (1usize, file.size_bytes))).fold((0usize, 0u64), |(count, bytes), (file_count, file_bytes)| (count + file_count, bytes.saturating_add(file_bytes)));
    let total_files = expected.files.len().max(actual.files.len());
    let expected_bytes = expected.files.iter().fold(0u64, |sum, file| sum.saturating_add(file.size_bytes));
    let actual_bytes = actual.files.iter().fold(0u64, |sum, file| sum.saturating_add(file.size_bytes));
    let total_bytes = expected_bytes.max(actual_bytes);
    let file_ratio = matching_files as f64 / total_files.max(1) as f64;
    let byte_ratio = if total_bytes == 0 { file_ratio } else { matching_bytes as f64 / total_bytes as f64 };
    RepairCandidate { record_id: record_id.to_string(), record_path: path.to_string(), folder_name: Path::new(path).file_name().and_then(|name| name.to_str()).unwrap_or_default().to_string(), folder_path: path.to_string(), matching_files, total_files, matching_bytes, total_bytes, match_percent: (((file_ratio + byte_ratio) / 2.0) * 100.0).round() as u8, reason: if expected.content_matches(actual) { "ambiguousFull".into() } else { "partial".into() }, source_fingerprint: Some(expected.clone()), item, external_publication: external }
}
