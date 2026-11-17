use super::super::fingerprint::SkinFingerprint;
use super::analysis::safe_skin_dir;
use super::types::{Folder, RepairCandidate};
use crate::{game_install, AppError};
use serde_json::{json, Value};
use std::{collections::HashMap, fs};
pub(crate) fn confirm_candidate(
    library: &mut Value,
    candidate: &RepairCandidate,
    game_path: &str,
) -> Result<(), AppError> {
    game_install::validate(game_path)?;
    let game_root = fs::canonicalize(game_path)?;
    let user_skins_metadata = fs::symlink_metadata(game_root.join("UserSkins"))?;
    if !user_skins_metadata.is_dir()
        || user_skins_metadata.file_type().is_symlink()
        || super::super::fingerprint::is_reparse_point(&user_skins_metadata)
    {
        return Err(AppError::new("skin_invalid_folder"));
    }
    let user_skins = fs::canonicalize(game_root.join("UserSkins"))?;
    let target_path = fs::canonicalize(&candidate.folder_path)?;
    if target_path.parent() != Some(user_skins.as_path())
        || !safe_skin_dir(&target_path, &user_skins)
    {
        return Err(AppError::new("skin_repair_candidate_changed"));
    }
    let target = normalize_path(&candidate.folder_path);
    let current_fingerprint = SkinFingerprint::compute(&target_path)
        .map_err(|error| AppError::with_detail("skin_repair_hash_failed", error.to_string()))?;
    if let Some(expected) = &candidate.source_fingerprint {
        let (matching_files, matching_bytes) = overlap(expected, &current_fingerprint);
        if (candidate.reason == "ambiguousFull" && !expected.content_matches(&current_fingerprint))
            || (candidate.reason == "partial"
                && (matching_files != candidate.matching_files
                    || matching_bytes != candidate.matching_bytes))
        {
            return Err(AppError::new("skin_repair_candidate_changed"));
        }
    }
    if library.get("externalSkinPublications").and_then(Value::as_array).is_some_and(|links| links.iter().any(|link| link.get("folderPath").and_then(Value::as_str).is_some_and(|path| normalize_path(path) == target))) {
        return Err(AppError::new("skin_repair_folder_claimed"));
    }
    let external_link = {
        let skins = library
            .get_mut("installedSkins")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| AppError::new("local_library_corrupt"))?;
        let target_claims = skins
            .iter()
            .filter(|skin| {
                skin.get("path")
                    .and_then(Value::as_str)
                    .is_some_and(|path| normalize_path(path) == target)
            })
            .count();
        let record_claims = skins
            .iter()
            .filter(|skin| skin.get("recordId").and_then(Value::as_str) == Some(&candidate.record_id))
            .count();
        if target_claims > 1
            || record_claims > 1
            || skins.iter().any(|skin| {
                skin.get("path")
                    .and_then(Value::as_str)
                    .is_some_and(|path| {
                        normalize_path(path) == target
                            && skin.get("recordId").and_then(Value::as_str) != Some(&candidate.record_id)
                            && (skin.get("item").is_some() || skin.get("externalPublication").is_some() || skin.get("fingerprint").is_some())
                    })
            })
        {
            return Err(AppError::new("skin_repair_folder_claimed"));
        }
        let record = skins
            .iter_mut()
            .find(|skin| skin.get("recordId").and_then(Value::as_str) == Some(&candidate.record_id))
            .ok_or_else(|| AppError::new("skin_repair_record_changed"))?;
        if record.get("availability").and_then(Value::as_str) == Some("present")
            && (candidate.item.is_none() && candidate.external_publication.is_none()
                || normalize_path(&candidate.record_path) != target)
        {
            return Err(AppError::new("skin_repair_folder_claimed"));
        }
        if candidate.item.is_none()
            && candidate.external_publication.is_none()
            && candidate
                .source_fingerprint
                .as_ref()
                .is_some_and(|expected| {
                    parse_fingerprint(record.get("fingerprint"))
                        .is_none_or(|saved| !saved.content_matches(expected))
                })
        {
            return Err(AppError::new("skin_repair_candidate_changed"));
        }
        if parse_fingerprint(record.get("fingerprint")).is_none_or(|saved| saved.origin == super::super::fingerprint::FingerprintOrigin::Baseline) {
            record["fingerprint"] = serde_json::to_value(current_fingerprint.clone().as_baseline())
                .map_err(|_| AppError::new("local_library_corrupt"))?;
        }
        // Remove only an unlinked scan placeholder for this exact destination.
        skins.retain(|skin| skin.get("recordId").and_then(Value::as_str) == Some(&candidate.record_id)
            || !skin.get("path").and_then(Value::as_str).is_some_and(|path| normalize_path(path) == target)
            || skin.get("item").is_some() || skin.get("externalPublication").is_some() || skin.get("fingerprint").is_some());
        let record = skins.iter_mut().find(|skin| skin.get("recordId").and_then(Value::as_str) == Some(&candidate.record_id)).ok_or_else(|| AppError::new("skin_repair_record_changed"))?;
        record["folderName"] = json!(candidate.folder_name);
        record["path"] = json!(candidate.folder_path);
        record["availability"] = json!("present");
        if let Some(existing) = record.get("externalPublication").cloned() {
            let mut moved = existing;
            moved["folderPath"] = json!(target_path.to_string_lossy().to_string());
            record["externalPublication"] = moved;
        }
        if let Some(item) = &candidate.item {
            if item.get("id").and_then(Value::as_u64).is_none()
                || item.get("langGroup").and_then(Value::as_u64).is_none()
            {
                return Err(AppError::new("local_library_corrupt"));
            }
            if record
                .get("item")
                .and_then(|saved| saved.get("id"))
                .and_then(Value::as_u64)
                .is_some_and(|id| Some(id) != item.get("id").and_then(Value::as_u64))
            {
                return Err(AppError::new("skin_repair_record_changed"));
            }
            if record.get("externalPublication").and_then(|saved| saved.get("item")).and_then(|saved| saved.get("id"))
                .is_some_and(|id| Some(id) != item.get("id"))
            {
                return Err(AppError::new("skin_repair_folder_claimed"));
            }
            record["item"] = item.clone();
        }
        if let Some(publication) = &candidate.external_publication {
            let item = publication
                .get("item")
                .ok_or_else(|| AppError::new("local_library_corrupt"))?;
            if item.get("id").and_then(Value::as_u64).is_none()
                || item.get("langGroup").and_then(Value::as_u64).is_none()
            {
                return Err(AppError::new("local_library_corrupt"));
            }
            if record.get("item").and_then(|saved| saved.get("id"))
                .is_some_and(|id| Some(id) != item.get("id"))
                || record.get("externalPublication").and_then(|saved| saved.get("item")).and_then(|saved| saved.get("id"))
                    .is_some_and(|id| Some(id) != item.get("id"))
            {
                return Err(AppError::new("skin_repair_folder_claimed"));
            }
            let link = json!({"item": item, "confirmedAt": publication.get("confirmedAt").and_then(Value::as_str).unwrap_or(""), "folderPath": target_path.to_string_lossy()});
            record["externalPublication"] = link.clone();
            Some(link)
        } else {
            record.get("externalPublication").cloned()
        }
    };
    if let Some(link) = external_link {
        if !library
            .get("externalSkinPublications")
            .is_some_and(Value::is_array)
        {
            library["externalSkinPublications"] = json!([]);
        }
        let links = library
            .get_mut("externalSkinPublications")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| AppError::new("local_library_corrupt"))?;
        links.retain(|saved| {
            saved
                .get("folderPath")
                .and_then(Value::as_str)
                .is_none_or(|path| normalize_path(path) != target && normalize_path(path) != normalize_path(&candidate.record_path))
        });
        links.push(link);
    }
    Ok(())
}
pub(super) fn parse_fingerprint(value: Option<&Value>) -> Option<SkinFingerprint> {
    serde_json::from_value(value?.clone())
        .ok()
        .filter(SkinFingerprint::is_valid)
}

pub(super) fn link_record(record: &mut Value, folder: &Folder) {
    record["folderName"] = json!(folder.name);
    record["path"] = json!(folder.path.to_string_lossy().to_string());
    record["availability"] = json!("present");
}

pub(super) fn overlap(saved: &SkinFingerprint, current: &SkinFingerprint) -> (usize, u64) {
    let current_files: HashMap<&str, _> = current
        .files
        .iter()
        .map(|file| (file.relative_path.as_str(), file))
        .collect();
    saved
        .files
        .iter()
        .filter_map(|file| {
            current_files
                .get(file.relative_path.as_str())
                .filter(|other| file.size_bytes == other.size_bytes && file.hash == other.hash)
                .map(|_| (1usize, file.size_bytes))
        })
        .fold((0, 0), |(files, bytes), (count, size)| {
            (files + count, bytes.saturating_add(size))
        })
}

pub(super) fn match_percent(
    saved: &SkinFingerprint,
    current: &SkinFingerprint,
    matching_files: usize,
    matching_bytes: u64,
) -> u8 {
    let file_ratio =
        matching_files as f64 / saved.files.len().max(current.files.len()).max(1) as f64;
    let saved_bytes = total_bytes(saved);
    let current_bytes = total_bytes(current);
    let byte_ratio = if saved_bytes.max(current_bytes) == 0 {
        file_ratio
    } else {
        matching_bytes as f64 / saved_bytes.max(current_bytes) as f64
    };
    (((file_ratio + byte_ratio) / 2.0) * 100.0).round() as u8
}

pub(super) fn total_bytes(fingerprint: &SkinFingerprint) -> u64 {
    fingerprint
        .files
        .iter()
        .fold(0u64, |sum, file| sum.saturating_add(file.size_bytes))
}
pub(super) fn normalize_path(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    if normalized.to_lowercase().starts_with("//?/unc/") {
        normalized = format!("//{}", &normalized[8..]);
    } else if normalized.starts_with("//?/") {
        normalized = normalized[4..].to_string();
    }
    normalized.trim_end_matches('/').to_lowercase()
}
