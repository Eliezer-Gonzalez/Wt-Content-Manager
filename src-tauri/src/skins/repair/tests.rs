use super::{analyze, confirm_candidate, RepairCandidate};
use crate::skins::fingerprint::{FingerprintOrigin, SkinFingerprint};
use serde_json::{json, Value};
use std::sync::atomic::AtomicBool;
use tempfile::TempDir;

fn fixture() -> (TempDir, String) {
    let root = tempfile::tempdir().unwrap();
    std::fs::write(root.path().join("aces.exe"), b"game").unwrap();
    std::fs::create_dir(root.path().join("UserSkins")).unwrap();
    (root, "".into())
}

fn write_skin(root: &std::path::Path, name: &str, files: &[(&str, &[u8])]) -> std::path::PathBuf {
    let path = root.join("UserSkins").join(name);
    std::fs::create_dir_all(&path).unwrap();
    for (relative, content) in files {
        let file = path.join(relative);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(file, content).unwrap();
    }
    path
}

fn record(
    path: &std::path::Path,
    fingerprint: Option<SkinFingerprint>,
    availability: &str,
    id: u64,
) -> Value {
    let mut record = json!({"recordId": format!("record-{id}"), "availability": availability, "folderName": path.file_name().unwrap().to_string_lossy(), "path": path.to_string_lossy(), "fileCount": 1, "sizeBytes": 4, "installedAt": "", "item": {"id": id, "langGroup": id, "title": "Skin", "author": "Author"}});
    if let Some(fingerprint) = fingerprint {
        record["fingerprint"] = serde_json::to_value(fingerprint).unwrap();
    }
    record
}

fn library(records: Vec<Value>) -> Value {
    json!({"favorites": [], "installedSkins": records, "externalSkinPublications": [], "repairRevision": 2})
}

fn run(root: &TempDir, value: Value) -> Result<super::RepairResult, crate::AppError> {
    analyze(
        root.path().to_str().unwrap(),
        value,
        &AtomicBool::new(false),
        |_| {},
    )
}

#[test]
fn renamed_folder_is_recovered_by_unique_full_fingerprint() {
    let (root, _) = fixture();
    let old = root.path().join("UserSkins/OldName");
    let new = write_skin(root.path(), "Renamed", &[("skin.blk", b"same")]);
    let saved = SkinFingerprint::compute(&new).unwrap();
    let result = run(
        &root,
        library(vec![record(&old, Some(saved), "missing", 1)]),
    )
    .unwrap();
    assert_eq!(result.auto_linked, 1);
    assert_eq!(
        std::fs::canonicalize(
            result.library["installedSkins"][0]["path"]
                .as_str()
                .unwrap()
        )
        .unwrap(),
        std::fs::canonicalize(new).unwrap()
    );
}

#[test]
fn renamed_folder_is_recovered_after_rescan_added_an_unlinked_placeholder() {
    let (root, _) = fixture();
    let old = root.path().join("UserSkins/OldName");
    let current = write_skin(root.path(), "Renamed", &[("skin.blk", b"same")]);
    let saved = SkinFingerprint::compute(&current).unwrap();
    let mut placeholder = record(&current, None, "present", 99);
    placeholder.as_object_mut().unwrap().remove("item");
    placeholder.as_object_mut().unwrap().remove("recordId");
    let result = run(&root, library(vec![placeholder, record(&old, Some(saved), "missing", 1)])).unwrap();
    assert_eq!(result.auto_linked, 1);
    assert_eq!(result.library["installedSkins"][0]["fingerprint"], Value::Null);
    assert_eq!(std::fs::canonicalize(result.library["installedSkins"][1]["path"].as_str().unwrap()).unwrap(), std::fs::canonicalize(&current).unwrap());
}

#[test]
fn partial_match_is_a_candidate_and_not_automatically_linked() {
    let (root, _) = fixture();
    let old = root.path().join("UserSkins/Old");
    let current = write_skin(
        root.path(),
        "New",
        &[("skin.blk", b"same"), ("extra.dds", b"new")],
    );
    let baseline = tempfile::tempdir().unwrap();
    std::fs::write(baseline.path().join("skin.blk"), b"same").unwrap();
    std::fs::write(baseline.path().join("removed.dds"), b"gone").unwrap();
    let saved = SkinFingerprint::compute(baseline.path()).unwrap();
    let result = run(
        &root,
        library(vec![record(&old, Some(saved), "missing", 1)]),
    )
    .unwrap();
    assert_eq!(result.auto_linked, 0);
    assert_eq!(result.candidates.len(), 1);
    assert!(result.candidates[0].match_percent < 100);
    assert_eq!(
        result.library["installedSkins"][0]["availability"],
        "missing"
    );
    assert!(current.exists());
}

#[test]
fn multiple_full_matches_are_candidates_not_automatic_links() {
    let (root, _) = fixture();
    let first = write_skin(root.path(), "CopyA", &[("skin.blk", b"same")]);
    write_skin(root.path(), "CopyB", &[("skin.blk", b"same")]);
    let old = root.path().join("UserSkins/Old");
    let result = run(
        &root,
        library(vec![record(
            &old,
            Some(SkinFingerprint::compute(&first).unwrap()),
            "missing",
            1,
        )]),
    )
    .unwrap();
    assert_eq!(result.auto_linked, 0);
    assert_eq!(result.candidates.len(), 2);
    assert!(result
        .candidates
        .iter()
        .all(|candidate| candidate.reason == "ambiguousFull"));
}

#[test]
fn two_records_claiming_one_folder_are_not_repaired_automatically() {
    let (root, _) = fixture();
    let current = write_skin(root.path(), "Shared", &[("skin.blk", b"same")]);
    let fingerprint = SkinFingerprint::compute(&current).unwrap();
    let result = run(
        &root,
        library(vec![
            record(&current, Some(fingerprint.clone()), "present", 1),
            record(&current, Some(fingerprint), "present", 2),
        ]),
    )
    .unwrap();
    assert_eq!(result.auto_linked, 0);
    assert_eq!(
        result.library["installedSkins"][0]["availability"],
        "needsReview"
    );
    assert_eq!(
        result.library["installedSkins"][1]["availability"],
        "needsReview"
    );
}

#[test]
fn candidate_confirmation_cannot_take_a_claimed_folder() {
    let (root, _) = fixture();
    let source = root.path().join("UserSkins/Old");
    let target = write_skin(root.path(), "Taken", &[("skin.blk", b"same")]);
    let mut data = library(vec![
        record(&source, None, "missing", 1),
        record(&target, None, "present", 2),
    ]);
    let candidate = RepairCandidate {
        record_id: "record-1".into(),
        record_path: source.to_string_lossy().to_string(),
        folder_name: "Taken".into(),
        folder_path: target.to_string_lossy().to_string(),
        matching_files: 1,
        total_files: 1,
        matching_bytes: 4,
        total_bytes: 4,
        match_percent: 100,
        reason: "legacyName".into(),
        source_fingerprint: None,
        item: None,
        external_publication: None,
    };
    assert!(confirm_candidate(&mut data, &candidate, root.path().to_str().unwrap()).is_err());
}

#[test]
fn confirming_a_renamed_external_skin_moves_both_publication_paths() {
    let (root, _) = fixture();
    let old = root.path().join("UserSkins/OldExternal");
    let target = write_skin(root.path(), "RenamedExternal", &[("skin.blk", b"skin")]);
    let item = json!({"id":7,"langGroup":8,"title":"External","author":"Author"});
    let external = json!({"item":item,"folderPath":old,"confirmedAt":""});
    let mut data = library(vec![json!({"recordId":"external-1","availability":"missing","folderName":"OldExternal","path":old,"fileCount":1,"sizeBytes":4,"installedAt":"","externalPublication":external.clone()})]);
    data["externalSkinPublications"] = json!([external]);
    let candidate = RepairCandidate {
        record_id: "external-1".into(), record_path: old.to_string_lossy().to_string(), folder_name: "RenamedExternal".into(),
        folder_path: target.to_string_lossy().to_string(), matching_files: 0, total_files: 0, matching_bytes: 0, total_bytes: 0,
        match_percent: 0, reason: "legacyName".into(), source_fingerprint: None, item: None, external_publication: None,
    };
    confirm_candidate(&mut data, &candidate, root.path().to_str().unwrap()).unwrap();
    let linked = &data["installedSkins"][0]["externalPublication"]["folderPath"];
    assert_eq!(std::fs::canonicalize(linked.as_str().unwrap()).unwrap(), std::fs::canonicalize(&target).unwrap());
    assert_eq!(data["externalSkinPublications"].as_array().unwrap().len(), 1);
    assert_eq!(std::fs::canonicalize(data["externalSkinPublications"][0]["folderPath"].as_str().unwrap()).unwrap(), std::fs::canonicalize(&target).unwrap());
}

#[test]
fn same_path_with_changed_fingerprint_is_marked_needs_review() {
    let (root, _) = fixture();
    let current = write_skin(root.path(), "Skin", &[("skin.blk", b"new")]);
    let old = tempfile::tempdir().unwrap();
    std::fs::write(old.path().join("skin.blk"), b"old").unwrap();
    let original = SkinFingerprint::compute(old.path()).unwrap();
    let result = run(
        &root,
        library(vec![record(
            &current,
            Some(original.clone()),
            "present",
            1,
        )]),
    )
    .unwrap();
    assert_eq!(
        result.library["installedSkins"][0]["availability"],
        "needsReview"
    );
    let preserved: SkinFingerprint = serde_json::from_value(result.library["installedSkins"][0]["fingerprint"].clone()).unwrap();
    assert_eq!(preserved.global_hash, original.global_hash);
    assert_eq!(result.auto_linked, 0);
}

#[test]
fn legacy_record_gets_a_baseline_only_when_its_saved_path_is_found() {
    let (root, _) = fixture();
    let current = write_skin(root.path(), "Skin", &[("skin.blk", b"current")]);
    let result = run(&root, library(vec![record(&current, None, "present", 1)])).unwrap();
    let fingerprint: SkinFingerprint =
        serde_json::from_value(result.library["installedSkins"][0]["fingerprint"].clone()).unwrap();
    assert_eq!(fingerprint.origin, FingerprintOrigin::Baseline);
    let missing = root.path().join("UserSkins/Gone");
    let result = run(&root, library(vec![record(&missing, None, "missing", 2)])).unwrap();
    assert!(result.library["installedSkins"][0]
        .get("fingerprint")
        .is_none());
}

#[test]
fn baseline_fingerprint_never_auto_links_a_different_folder() {
    let (root, _) = fixture();
    let current = write_skin(root.path(), "New", &[("skin.blk", b"same")]);
    let saved = SkinFingerprint::compute(&current).unwrap().as_baseline();
    let old = root.path().join("UserSkins/Old");
    let result = run(
        &root,
        library(vec![record(&old, Some(saved), "missing", 1)]),
    )
    .unwrap();
    assert_eq!(result.auto_linked, 0);
}

#[test]
fn no_match_keeps_the_record_missing() {
    let (root, _) = fixture();
    let old = root.path().join("UserSkins/Gone");
    let saved_root = tempfile::tempdir().unwrap();
    std::fs::write(saved_root.path().join("skin.blk"), b"old").unwrap();
    let result = run(
        &root,
        library(vec![record(
            &old,
            Some(SkinFingerprint::compute(saved_root.path()).unwrap()),
            "missing",
            1,
        )]),
    )
    .unwrap();
    assert_eq!(
        result.library["installedSkins"][0]["availability"],
        "missing"
    );
    assert!(result.candidates.is_empty());
}

#[test]
fn cancellation_returns_without_a_library_result_to_commit() {
    let (root, _) = fixture();
    write_skin(root.path(), "New", &[("skin.blk", b"same")]);
    let old = root.path().join("UserSkins/Old");
    let before = library(vec![record(&old, None, "missing", 1)]);
    let cancelled = AtomicBool::new(false);
    let result = analyze(
        root.path().to_str().unwrap(),
        before.clone(),
        &cancelled,
        |progress| {
            if progress.phase == "hashing" {
                cancelled.store(true, std::sync::atomic::Ordering::SeqCst);
            }
        },
    );
    assert!(result.is_err());
    assert_eq!(before["installedSkins"][0].get("fingerprint"), None);
}
