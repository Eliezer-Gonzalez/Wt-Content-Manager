use super::super::fingerprint::{FingerprintOrigin, SkinFingerprint};
use super::matching::{
    link_record, match_percent, normalize_path, overlap, parse_fingerprint, total_bytes,
};
use super::types::Folder;
use super::{RepairCandidate, RepairProgress, RepairResult};
use crate::{game_install, AppError};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};
pub(crate) fn analyze(
    game_path: &str,
    mut library: Value,
    cancelled: &AtomicBool,
    mut progress: impl FnMut(RepairProgress),
) -> Result<RepairResult, AppError> {
    game_install::validate(game_path)?;
    let _game_guard = super::super::recovery::lock_game_filesystem();
    let root = fs::canonicalize(game_path)?;
    let user_skins = root.join("UserSkins");
    let metadata = match fs::symlink_metadata(&user_skins) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => metadata,
        Ok(_) => return Err(AppError::new("skin_invalid_folder")),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            if let Some(records) = library
                .get_mut("installedSkins")
                .and_then(Value::as_array_mut)
            {
                for record in records {
                    if record.get("availability").and_then(Value::as_str) != Some("needsReview") {
                        record["availability"] = json!("missing");
                    }
                }
            }
            library["repairRevision"] = json!(library
                .get("repairRevision")
                .and_then(Value::as_u64)
                .unwrap_or(0)
                .saturating_add(1));
            return Ok(RepairResult {
                library,
                candidates: vec![],
                auto_linked: 0,
                baseline_count: 0,
            });
        }
        Err(error) => return Err(error.into()),
    };
    let _ = metadata;
    let user_skins = fs::canonicalize(user_skins)?;
    let external_claims: HashSet<String> = library.get("externalSkinPublications").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|link| link.get("folderPath").and_then(Value::as_str).map(normalize_path)).collect();
    let records = library
        .get_mut("installedSkins")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| AppError::new("local_library_corrupt"))?;
    let mut claimed: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, record) in records.iter_mut().enumerate() {
        super::ensure_record_id(record, index);
        if record.get("item").is_some() || record.get("externalPublication").is_some() || record.get("fingerprint").is_some() || record.get("path").and_then(Value::as_str).is_some_and(|path| external_claims.contains(&normalize_path(path))) {
            if let Some(path) = record.get("path").and_then(Value::as_str) {
                if Path::new(path).exists() && fs::canonicalize(path).is_ok_and(|canonical| safe_skin_dir(&canonical, &user_skins)) {
                    claimed.entry(normalize_path(path)).or_default().push(index);
                }
            }
        }
    }

    let mut candidates_folders = Vec::new();
    let mut baseline_count = 0;
    let mut checked = HashSet::new();
    let total = records.len();
    for index in 0..records.len() {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AppError::new("download_cancelled"));
        }
        let record = &records[index];
        let saved_path = record
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let path_on_disk = resolve_user_skin_path(saved_path);
        let Some(actual_path) = path_on_disk.filter(|path| safe_skin_dir(path, &user_skins)) else {
            if records[index].get("availability").and_then(Value::as_str) != Some("needsReview") {
                records[index]["availability"] = json!("missing");
            }
            continue;
        };
        let key = normalize_path(&actual_path.to_string_lossy());
        if !checked.insert(key.clone()) {
            continue;
        }
        if let Some(claimants) = claimed.get(&key).filter(|claimants| claimants.len() > 1) {
            for claimant in claimants {
                records[*claimant]["availability"] = json!("needsReview");
            }
            continue;
        }
        let fingerprint = hash_folder(&actual_path, cancelled, &mut progress, index + 1, total)?;
        if let Some(saved) = parse_fingerprint(record.get("fingerprint")) {
            if saved.content_matches(&fingerprint) {
                if let Some(record) = records[index].as_object_mut() {
                    record.insert("availability".into(), Value::String("present".into()));
                }
                continue;
            }
            if let Some(record) = records[index].as_object_mut() {
                record.insert("availability".into(), Value::String("needsReview".into()));
            }
        } else if normalize_path(saved_path) == normalize_path(&actual_path.to_string_lossy())
            && (records[index].get("item").is_some() || records[index].get("externalPublication").is_some())
        {
            records[index]["fingerprint"] = serde_json::to_value(fingerprint.clone().as_baseline())
                .map_err(|_| AppError::new("local_library_corrupt"))?;
            records[index]["availability"] = json!("present");
            baseline_count += 1;
        }
    }

    let entries = fs::read_dir(&user_skins)?;
    for entry in entries {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AppError::new("download_cancelled"));
        }
        let entry = entry?;
        let meta = fs::symlink_metadata(entry.path())?;
        if meta.file_type().is_symlink() || super::super::fingerprint::is_reparse_point(&meta) {
            return Err(AppError::new("skin_repair_hash_failed"));
        }
        if !meta.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || super::super::is_orphan_staging_dir(&name) {
            continue;
        }
        let path = fs::canonicalize(entry.path())?;
        if !safe_skin_dir(&path, &user_skins)
            || claimed.contains_key(&normalize_path(&path.to_string_lossy()))
        {
            continue;
        }
        candidates_folders.push((name, path));
    }
    let count = candidates_folders.len();
    let mut folders = Vec::with_capacity(count);
    for (index, (name, path)) in candidates_folders.into_iter().enumerate() {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AppError::new("download_cancelled"));
        }
        if !has_skin_definition(&path)? {
            continue;
        }
        let fingerprint = hash_folder(&path, cancelled, &mut progress, index + 1, count)?;
        folders.push(Folder {
            name,
            path,
            fingerprint,
        });
    }

    // Records with install-time fingerprints are the only records eligible for automatic recovery.
    let recoverable: Vec<usize> = records
        .iter()
        .enumerate()
        .filter_map(|(index, record)| {
            let fp = parse_fingerprint(record.get("fingerprint"))?;
            (fp.origin == FingerprintOrigin::Install
                && record.get("availability").and_then(Value::as_str) != Some("present")
                && record.get("availability").and_then(Value::as_str) != Some("needsReview"))
            .then_some(index)
        })
        .collect();
    let mut full_edges: Vec<Vec<usize>> = vec![vec![]; recoverable.len()];
    let mut candidate_edges: Vec<Vec<usize>> = vec![vec![]; recoverable.len()];
    let mut folder_degrees = vec![0usize; folders.len()];
    for (ri, record_index) in recoverable.iter().enumerate() {
        let saved = parse_fingerprint(records[*record_index].get("fingerprint"))
            .expect("eligible fingerprint");
        for (fi, folder) in folders.iter().enumerate() {
            if saved.content_matches(&folder.fingerprint) {
                full_edges[ri].push(fi);
            }
            if overlap(&saved, &folder.fingerprint).0 > 0 {
                candidate_edges[ri].push(fi);
                folder_degrees[fi] += 1;
            }
        }
    }
    let mut auto_links = Vec::new();
    for (ri, edges) in full_edges.iter().enumerate() {
        if edges.len() == 1 && candidate_edges[ri].len() == 1 && folder_degrees[edges[0]] == 1 {
            auto_links.push((recoverable[ri], edges[0]));
        }
    }
    for (record_index, folder_index) in &auto_links {
        link_record(&mut records[*record_index], &folders[*folder_index]);
    }
    let auto_set: HashSet<(usize, usize)> = auto_links.iter().copied().collect();
    let mut repair_candidates = Vec::new();
    for (ri, record_index) in recoverable.iter().enumerate() {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AppError::new("download_cancelled"));
        }
        let saved = parse_fingerprint(records[*record_index].get("fingerprint"))
            .expect("eligible fingerprint");
        for (fi, folder) in folders.iter().enumerate() {
            if auto_set.contains(&(*record_index, fi)) {
                continue;
            }
            let (matching_files, matching_bytes) = overlap(&saved, &folder.fingerprint);
            if matching_files == 0 {
                continue;
            }
            let percent =
                match_percent(&saved, &folder.fingerprint, matching_files, matching_bytes);
            repair_candidates.push(RepairCandidate {
                record_id: records[*record_index].get("recordId").and_then(Value::as_str).unwrap_or_default().to_string(),
                record_path: records[*record_index]
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                folder_name: folder.name.clone(),
                folder_path: folder.path.to_string_lossy().to_string(),
                matching_files,
                total_files: saved.files.len().max(folder.fingerprint.files.len()),
                matching_bytes,
                total_bytes: total_bytes(&saved).max(total_bytes(&folder.fingerprint)),
                match_percent: percent,
                reason: if full_edges[ri].contains(&fi) {
                    "ambiguousFull"
                } else {
                    "partial"
                }
                .to_string(),
                source_fingerprint: Some(saved.clone()),
                item: None,
                external_publication: None,
            });
        }
    }
    // Legacy records have no proof of identity. Same-name folders are offered only as candidates.
    for record in records.iter() {
        if parse_fingerprint(record.get("fingerprint")).is_some_and(|fingerprint| fingerprint.origin == FingerprintOrigin::Install)
            || record.get("availability").and_then(Value::as_str) != Some("missing") { continue; }
        let record_id = record.get("recordId").and_then(Value::as_str).unwrap_or_default().to_string();
        let record_path = record.get("path").and_then(Value::as_str).unwrap_or_default().to_string();
        let name = record.get("folderName").and_then(Value::as_str).unwrap_or_default();
        for folder in &folders {
            if !folder.name.eq_ignore_ascii_case(name) { continue; }
            repair_candidates.push(RepairCandidate {
                record_id: record_id.clone(), record_path: record_path.clone(), folder_name: folder.name.clone(),
                folder_path: folder.path.to_string_lossy().to_string(), matching_files: 0, total_files: 0,
                matching_bytes: 0, total_bytes: 0, match_percent: 0, reason: "legacyName".to_string(),
                source_fingerprint: None, item: None, external_publication: None,
            });
        }
    }
    // Candidate-only import matching is appended by the import flow.
    if cancelled.load(Ordering::SeqCst) {
        return Err(AppError::new("download_cancelled"));
    }
    let revision = library
        .get("repairRevision")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .saturating_add(1);
    library["repairRevision"] = json!(revision);
    Ok(RepairResult {
        library,
        candidates: repair_candidates,
        auto_linked: auto_links.len(),
        baseline_count,
    })
}
fn hash_folder(
    path: &Path,
    cancelled: &AtomicBool,
    progress: &mut impl FnMut(RepairProgress),
    completed: usize,
    total: usize,
) -> Result<SkinFingerprint, AppError> {
    let folder = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string();
    let mut last_reported_bytes = 0_u64;
    progress(RepairProgress {
        phase: "hashing",
        completed,
        total,
        current: folder.clone(),
    });
    let result = SkinFingerprint::compute_controlled(path, |bytes| {
        if bytes.saturating_sub(last_reported_bytes) >= 4 * 1024 * 1024 {
            last_reported_bytes = bytes;
            progress(RepairProgress {
                phase: "hashing",
                completed,
                total,
                current: folder.clone(),
            });
        }
        !cancelled.load(Ordering::SeqCst)
    });
    match result {
        Ok(fp) => Ok(fp),
        Err(error)
            if cancelled.load(Ordering::SeqCst) || error.kind() == ErrorKind::Interrupted =>
        {
            Err(AppError::new("download_cancelled"))
        }
        Err(error) => Err(AppError::with_detail(
            "skin_repair_hash_failed",
            error.to_string(),
        )),
    }
}

fn resolve_user_skin_path(saved_path: &str) -> Option<PathBuf> {
    let path = Path::new(saved_path);
    let candidate = path.exists().then(|| path.to_path_buf())?;
    Some(fs::canonicalize(candidate).ok()?)
}

pub(super) fn safe_skin_dir(path: &Path, root: &Path) -> bool {
    let Ok(root) = fs::canonicalize(root) else {
        return false;
    };
    let Ok(meta) = fs::symlink_metadata(path) else {
        return false;
    };
    meta.is_dir() && !meta.file_type().is_symlink() && path.parent() == Some(root.as_path())
}

fn has_skin_definition(path: &Path) -> std::io::Result<bool> {
    let mut pending = vec![path.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            let metadata = fs::symlink_metadata(entry.path())?;
            if metadata.file_type().is_symlink()
                || super::super::fingerprint::is_reparse_point(&metadata)
            {
                return Err(std::io::Error::new(
                    ErrorKind::InvalidData,
                    "skin contains a symbolic link or reparse point",
                ));
            }
            if metadata.is_dir() {
                pending.push(entry.path());
            } else if metadata.is_file()
                && entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("blk"))
            {
                return Ok(true);
            }
        }
    }
    Ok(false)
}
