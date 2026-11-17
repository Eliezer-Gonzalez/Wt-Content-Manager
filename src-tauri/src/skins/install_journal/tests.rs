use super::*;

fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf, Value) {
    let root = tempfile::tempdir().unwrap();
    let game = root.path().join("game");
    fs::create_dir_all(game.join("UserSkins")).unwrap();
    let app = root.path().join("app");
    fs::create_dir_all(&app).unwrap();
    let library = app.join("local-library.json");
    local_library::save(
        &library,
        &serde_json::json!({"favorites": [], "installedSkins": [], "externalSkinPublications": []}),
    )
    .unwrap();
    let staging = tempfile::Builder::new()
        .prefix(super::super::STAGING_PREFIX)
        .rand_bytes(super::super::STAGING_SUFFIX_LEN)
        .tempdir_in(&game)
        .unwrap()
        .keep();
    let item = serde_json::json!({"id": 42, "langGroup": 52, "title": "Skin", "author": "Author", "contentType": "camouflage"});
    (root, library, game, staging, item)
}

fn write_journal(library: &Path, game: &Path, staging: &Path, item: Value) {
    let destination = game.join("UserSkins").join("TestSkin");
    prepare(
        library,
        "tx-test",
        item,
        "TestSkin",
        &destination,
        staging,
        game,
        3,
        12,
        false,
        None,
    )
    .unwrap();
}

#[test]
fn crash_before_folder_commit_discards_only_owned_staging() {
    let (_root, library, game, staging, item) = fixture();
    write_journal(&library, &game, &staging, item);
    fs::write(staging.join("payload-file"), b"staged").unwrap();
    let unrelated = game.join("unrelated-folder");
    fs::create_dir(&unrelated).unwrap();
    fs::write(unrelated.join("keep.txt"), b"keep").unwrap();
    reconcile(&library).unwrap();
    assert!(!staging.exists());
    assert!(unrelated.join("keep.txt").exists());
    assert!(
        local_library::load(&library).unwrap().unwrap()["installedSkins"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[test]
fn crash_after_folder_commit_persists_link_and_retains_journal_until_frontend_acknowledges() {
    let (_root, library, game, staging, item) = fixture();
    write_journal(&library, &game, &staging, item.clone());
    fs::create_dir(game.join("UserSkins/TestSkin")).unwrap();
    fs::remove_dir_all(&staging).unwrap();
    reconcile(&library).unwrap();
    assert_eq!(
        local_library::load(&library).unwrap().unwrap()["installedSkins"][0]["item"]["id"],
        42
    );
    assert!(local_library::load(&library).unwrap().unwrap()["installedSkins"][0]["recordId"].as_str().is_some());
    let journal_file = entry_path(&library, "tx-test");
    assert!(journal_file.exists());
    save_with_journal(
        &library,
        &serde_json::json!({"favorites": [], "installedSkins": [], "externalSkinPublications": []}),
    )
    .unwrap();
    assert!(journal_file.exists());
    let current = local_library::load(&library).unwrap().unwrap();
    save_with_journal(&library, &current).unwrap();
    assert!(!journal_file.exists());
}

#[test]
fn existing_frontend_snapshot_cannot_acknowledge_reinstall_before_finalization() {
    let (_root, library, game, staging, item) = fixture();
    write_journal(&library, &game, &staging, item.clone());
    fs::create_dir(game.join("UserSkins/TestSkin")).unwrap();
    fs::remove_dir_all(&staging).unwrap();
    let already_linked = serde_json::json!({"favorites": [], "installedSkins": [{
        "availability": "present", "item": item, "folderName": "TestSkin", "path": game.join("UserSkins/TestSkin"),
        "fileCount": 3, "sizeBytes": 12, "installedAt": "2026-01-01T00:00:00Z"
    }], "externalSkinPublications": []});
    save_with_journal(&library, &already_linked).unwrap();
    assert!(entry_path(&library, "tx-test").exists());
    finalize(&library, "tx-test").unwrap();
    let finalized_entry = read_entry(&entry_path(&library, "tx-test")).unwrap();
    assert!(finalized_entry.finalized);
    assert!(has_record(&already_linked, &finalized_entry));
    save_with_journal(&library, &already_linked).unwrap();
    assert!(!entry_path(&library, "tx-test").exists());
}

#[test]
fn reconciliation_after_library_finalization_is_idempotent() {
    let (_root, library, game, staging, item) = fixture();
    write_journal(&library, &game, &staging, item);
    fs::create_dir(game.join("UserSkins/TestSkin")).unwrap();
    fs::remove_dir_all(&staging).unwrap();
    finalize(&library, "tx-test").unwrap();
    reconcile(&library).unwrap();
    reconcile(&library).unwrap();
    assert_eq!(
        local_library::load(&library).unwrap().unwrap()["installedSkins"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn ambiguous_both_present_preserves_both_and_marks_review_without_linking() {
    let (_root, library, game, staging, item) = fixture();
    write_journal(&library, &game, &staging, item);
    fs::create_dir(game.join("UserSkins/TestSkin")).unwrap();
    reconcile(&library).unwrap();
    assert!(staging.exists());
    assert!(game.join("UserSkins/TestSkin").exists());
    let record = &local_library::load(&library).unwrap().unwrap()["installedSkins"][0];
    assert_eq!(record["availability"], "needsReview");
    assert!(record.get("item").is_none() || record["item"].is_null());
}

#[test]
fn interrupted_replacement_restores_verified_previous_skin() {
    let (_root, library, game, staging, item) = fixture();
    let destination = game.join("UserSkins/TestSkin");
    prepare(
        &library,
        "tx-replace",
        item,
        "TestSkin",
        &destination,
        &staging,
        &game,
        3,
        12,
        true,
        None,
    )
    .unwrap();
    fs::create_dir(staging.join("previous-skin")).unwrap();
    fs::write(staging.join("previous-skin/original.blk"), b"old").unwrap();
    reconcile(&library).unwrap();
    assert!(destination.join("original.blk").exists());
    assert!(!staging.exists());
    assert!(!entry_path(&library, "tx-replace").exists());
}

#[test]
fn restored_old_destination_with_journal_and_stage_is_reviewed_without_relinking_new_publication() {
    let (_root, library, game, staging, new_item) = fixture();
    let destination = game.join("UserSkins/TestSkin");
    fs::create_dir(&destination).unwrap();
    let old_item =
        serde_json::json!({"id": 7, "langGroup": 8, "title": "Old skin", "author": "Old author"});
    let old_library = serde_json::json!({"favorites": [], "installedSkins": [{
        "availability": "present", "item": old_item, "folderName": "TestSkin", "path": destination,
        "fileCount": 1, "sizeBytes": 2, "installedAt": "2026-01-01T00:00:00Z"
    }], "externalSkinPublications": []});
    local_library::save(&library, &old_library).unwrap();
    let destination = game.join("UserSkins/TestSkin");
    prepare(
        &library,
        "tx-rollback-window",
        new_item,
        "TestSkin",
        &destination,
        &staging,
        &game,
        3,
        12,
        true,
        None,
    )
    .unwrap();
    reconcile(&library).unwrap();
    let record = &local_library::load(&library).unwrap().unwrap()["installedSkins"][0];
    assert_eq!(record["availability"], "needsReview");
    assert_eq!(record["item"]["id"], 7);
    assert!(staging.exists());
    assert!(entry_path(&library, "tx-rollback-window").exists());
}

#[test]
fn stale_frontend_snapshot_cannot_erase_explicit_external_link() {
    let (_root, library, game, _staging, item) = fixture();
    let folder = game.join("UserSkins/TestSkin");
    fs::create_dir(&folder).unwrap();
    persist_external_link(
        &library,
        "tx-external",
        item,
        "TestSkin",
        &folder,
        &game,
        2,
        10,
    )
    .unwrap();
    let stale =
        serde_json::json!({"favorites": [], "installedSkins": [], "externalSkinPublications": []});
    save_with_journal(&library, &stale).unwrap();
    assert!(external_entry_path(&library, "tx-external").exists());
    let saved = local_library::load(&library).unwrap().unwrap();
    assert_eq!(saved["externalSkinPublications"][0]["item"]["id"], 42);
    save_with_journal(&library, &saved).unwrap();
    assert!(!external_entry_path(&library, "tx-external").exists());
}

#[test]
fn stale_frontend_snapshot_cannot_overwrite_a_newer_skin_repair_revision() {
    let directory = tempfile::tempdir().unwrap();
    let library = directory.path().join("local-library.json");
    let latest = serde_json::json!({"favorites": [], "installedSkins": [{"availability":"present","folderName":"New","path":"C:/WT/UserSkins/New","fileCount":1,"sizeBytes":4,"installedAt":"","item":{"id":7,"langGroup":8,"title":"Skin","author":"Author"}}], "externalSkinPublications": [], "repairRevision": 8});
    local_library::save(&library, &latest).unwrap();
    let stale = serde_json::json!({"favorites": [], "installedSkins": [], "externalSkinPublications": [], "repairRevision": 7});

    let error = save_with_journal(&library, &stale).unwrap_err();

    assert_eq!(error.code, "local_library_stale_snapshot");
    assert_eq!(local_library::load(&library).unwrap().unwrap(), latest);
}

#[test]
fn repair_commit_consumes_only_the_unlinked_rescan_placeholder() {
    let (_root, library_path, game, _staging, item) = fixture();
    fs::write(game.join("aces.exe"), b"game").unwrap();
    let old_path = format!("\\\\?\\{}", game.join("UserSkins/OldName").to_string_lossy());
    let target = game.join("UserSkins/Renamed");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("skin.blk"), b"same").unwrap();
    let fingerprint = SkinFingerprint::compute(&target).unwrap();
    let linked = serde_json::json!({"availability":"missing","folderName":"OldName","path":old_path,"fileCount":1,"sizeBytes":4,"installedAt":"","item":item,"fingerprint":fingerprint});
    let placeholder = serde_json::json!({"recordId":"placeholder","availability":"present","folderName":"Renamed","path":target,"fileCount":1,"sizeBytes":4,"installedAt":""});
    let base = serde_json::json!({"favorites":[],"installedSkins":[placeholder,linked],"externalSkinPublications":[],"repairRevision":3});
    local_library::save(&library_path, &base).unwrap();
    let proposed = super::super::repair::analyze(game.to_str().unwrap(), base.clone(), &std::sync::atomic::AtomicBool::new(false), |_| {}).unwrap();
    assert_eq!(proposed.auto_linked, 1);
    let saved = persist_repair_result(&library_path, game.to_str().unwrap(), &base, &proposed.library).unwrap();
    assert_eq!(saved["installedSkins"].as_array().unwrap().len(), 1);
    assert!(saved["installedSkins"][0]["recordId"].as_str().unwrap().starts_with("skin-1-"));
    assert_eq!(saved["installedSkins"][0]["item"]["id"], 42);
}

#[test]
fn repair_persists_missing_records_when_userskins_directory_is_absent() {
    let (_root, library_path, game, _staging, item) = fixture();
    fs::write(game.join("aces.exe"), b"game").unwrap();
    let missing = game.join("UserSkins/Missing");
    let record = serde_json::json!({"recordId":"missing-1","availability":"present","folderName":"Missing","path":missing,"fileCount":1,"sizeBytes":4,"installedAt":"","item":item});
    let base = serde_json::json!({"favorites":[],"installedSkins":[record],"externalSkinPublications":[],"repairRevision":2});
    local_library::save(&library_path, &base).unwrap();
    fs::remove_dir_all(game.join("UserSkins")).unwrap();
    let proposed = super::super::repair::analyze(game.to_str().unwrap(), base.clone(), &std::sync::atomic::AtomicBool::new(false), |_| {}).unwrap();
    let saved = persist_repair_result(&library_path, game.to_str().unwrap(), &base, &proposed.library).unwrap();
    assert_eq!(saved["installedSkins"][0]["availability"], "missing");
    assert_eq!(saved["installedSkins"].as_array().unwrap().len(), 1);
}

#[test]
fn imported_install_fingerprint_links_only_after_rust_verifies_current_files() {
    let (_root, library_path, game, _staging, item) = fixture();
    let target = game.join("UserSkins/ImportedSkin");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("skin.blk"), b"content").unwrap();
    let fingerprint = SkinFingerprint::compute(&target).unwrap();
    let record = serde_json::json!({"recordId":"target-1","availability":"present","folderName":"ImportedSkin","path":target,"fileCount":1,"sizeBytes":7,"installedAt":""});
    let base = serde_json::json!({"favorites":[],"installedSkins":[record],"externalSkinPublications":[],"repairRevision":0});
    local_library::save(&library_path, &base).unwrap();
    let imported = vec![serde_json::json!({"folderName":"ImportedSkin","fingerprint":fingerprint,"item":item})];
    let control = super::super::repair::register_task("import-test-one").unwrap();
    let result = persist_import_result(&library_path, game.to_str().unwrap(), &base, &base, &imported, &control, |_| {}).unwrap();
    super::super::repair::finish_task("import-test-one");
    assert_eq!(result["autoLinked"], 1);
    assert_eq!(result["library"]["installedSkins"][0]["item"]["id"], 42);
}

#[test]
fn import_does_not_replace_an_existing_external_publication() {
    let (_root, library_path, game, _staging, item) = fixture();
    let target = game.join("UserSkins/External");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("skin.blk"), b"content").unwrap();
    let fingerprint = SkinFingerprint::compute(&target).unwrap();
    let existing = serde_json::json!({"id":77,"langGroup":88,"title":"Existing","author":"Author"});
    let record = serde_json::json!({"recordId":"target-1","availability":"present","folderName":"External","path":target,"fileCount":1,"sizeBytes":7,"installedAt":"","externalPublication":{"item":existing,"folderPath":target,"confirmedAt":""}});
    let base = serde_json::json!({"favorites":[],"installedSkins":[record],"externalSkinPublications":[],"repairRevision":0});
    local_library::save(&library_path, &base).unwrap();
    let imported = vec![serde_json::json!({"folderName":"External","fingerprint":fingerprint,"item":item})];
    let control = super::super::repair::register_task("import-test-two").unwrap();
    let result = persist_import_result(&library_path, game.to_str().unwrap(), &base, &base, &imported, &control, |_| {}).unwrap();
    super::super::repair::finish_task("import-test-two");
    assert_eq!(result["autoLinked"], 0);
    assert_eq!(result["library"]["installedSkins"][0]["externalPublication"]["item"]["id"], 77);
}

#[test]
fn import_does_not_auto_link_with_partial_or_legacy_name_competitors() {
    let (_root, library_path, game, _staging, item) = fixture();
    let original = tempfile::tempdir().unwrap();
    fs::write(original.path().join("skin.blk"), b"same").unwrap();
    fs::write(original.path().join("texture.dds"), b"base").unwrap();
    let fingerprint = SkinFingerprint::compute(original.path()).unwrap();
    let exact = game.join("UserSkins/Exact");
    fs::create_dir_all(&exact).unwrap();
    fs::write(exact.join("skin.blk"), b"same").unwrap();
    fs::write(exact.join("texture.dds"), b"base").unwrap();
    let partial = game.join("UserSkins/Partial");
    fs::create_dir_all(&partial).unwrap();
    fs::write(partial.join("skin.blk"), b"same").unwrap();
    fs::write(partial.join("texture.dds"), b"changed").unwrap();
    fs::write(partial.join("extra.dds"), b"extra").unwrap();
    let exact_record = serde_json::json!({"recordId":"target-1","availability":"present","folderName":"Exact","path":exact,"fileCount":2,"sizeBytes":8,"installedAt":""});
    let partial_record = serde_json::json!({"recordId":"target-2","availability":"present","folderName":"Partial","path":partial,"fileCount":3,"sizeBytes":20,"installedAt":""});
    let base = serde_json::json!({"favorites":[],"installedSkins":[exact_record,partial_record],"externalSkinPublications":[],"repairRevision":0});
    local_library::save(&library_path, &base).unwrap();
    let mut legacy_item = item.clone();
    legacy_item["id"] = serde_json::json!(43);
    legacy_item["langGroup"] = serde_json::json!(53);
    let imported = vec![
        serde_json::json!({"folderName":"Exact","fingerprint":fingerprint,"item":item}),
        serde_json::json!({"folderName":"Exact","item":legacy_item}),
    ];
    let control = super::super::repair::register_task("import-ambiguous").unwrap();
    let result = persist_import_result(&library_path, game.to_str().unwrap(), &base, &base, &imported, &control, |_| {}).unwrap();
    super::super::repair::finish_task("import-ambiguous");
    assert_eq!(result["autoLinked"], 0);
    assert_eq!(result["candidates"].as_array().unwrap().len(), 3);
    assert!(result["candidates"].as_array().unwrap().iter().any(|candidate| candidate["reason"] == "nameOnly"));
    assert!(result["library"]["installedSkins"].as_array().unwrap().iter().all(|record| record.get("item").is_none()));
}

#[test]
fn cancelling_import_hashing_leaves_library_unchanged() {
    let (_root, library_path, game, _staging, item) = fixture();
    let target = game.join("UserSkins/CancelTarget");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("large.dds"), vec![7u8; 8 * 1024 * 1024]).unwrap();
    let record = serde_json::json!({"recordId":"cancel-target","availability":"present","folderName":"CancelTarget","path":target,"fileCount":1,"sizeBytes":8388608,"installedAt":""});
    let base = serde_json::json!({"favorites":[],"installedSkins":[record],"externalSkinPublications":[],"repairRevision":0});
    local_library::save(&library_path, &base).unwrap();
    let before = local_library::load(&library_path).unwrap().unwrap();
    let imported = vec![serde_json::json!({"folderName":"CancelTarget","item":item})];
    let control = super::super::repair::register_task("import-cancel").unwrap();
    let result = persist_import_result(&library_path, game.to_str().unwrap(), &base, &base, &imported, &control, |progress| {
        if progress.phase == "hashing" { super::super::repair::cancel_task("import-cancel").unwrap(); }
    });
    super::super::repair::finish_task("import-cancel");
    assert_eq!(result.unwrap_err().code, "download_cancelled");
    assert_eq!(local_library::load(&library_path).unwrap().unwrap(), before);
}

#[test]
fn reconciliation_confirms_committed_folder_with_expected_fingerprint() {
    let (_root, library, game, staging, item) = fixture();
    let staged_skin = staging.join("skin-payload");
    fs::create_dir(&staged_skin).unwrap();
    fs::write(staged_skin.join("skin.blk"), b"valid skin").unwrap();
    let expected = SkinFingerprint::compute(&staged_skin).unwrap();
    let destination = game.join("UserSkins/TestSkin");
    prepare(
        &library,
        "tx-fingerprint",
        item,
        "TestSkin",
        &destination,
        &staging,
        &game,
        1,
        10,
        false,
        Some(expected.clone()),
    )
    .unwrap();
    fs::rename(&staged_skin, &destination).unwrap();
    fs::remove_dir_all(&staging).unwrap();

    reconcile(&library).unwrap();

    let record = &local_library::load(&library).unwrap().unwrap()["installedSkins"][0];
    assert_eq!(record["availability"], "present");
    assert_eq!(record["fingerprint"]["globalHash"], expected.global_hash);
    assert!(
        read_entry(&entry_path(&library, "tx-fingerprint"))
            .unwrap()
            .finalized
    );
}

#[test]
fn mismatched_fingerprint_is_preserved_for_review_without_linking() {
    let (_root, library, game, staging, item) = fixture();
    let staged_skin = staging.join("skin-payload");
    fs::create_dir(&staged_skin).unwrap();
    fs::write(staged_skin.join("skin.blk"), b"expected").unwrap();
    let expected = SkinFingerprint::compute(&staged_skin).unwrap();
    let destination = game.join("UserSkins/TestSkin");
    prepare(
        &library,
        "tx-fingerprint-mismatch",
        item,
        "TestSkin",
        &destination,
        &staging,
        &game,
        1,
        8,
        false,
        Some(expected),
    )
    .unwrap();
    fs::create_dir(&destination).unwrap();
    fs::write(destination.join("skin.blk"), b"modified").unwrap();
    fs::remove_dir_all(&staging).unwrap();

    reconcile(&library).unwrap();

    let record = &local_library::load(&library).unwrap().unwrap()["installedSkins"][0];
    assert_eq!(record["availability"], "needsReview");
    assert!(record.get("item").is_none() || record["item"].is_null());
    assert!(entry_path(&library, "tx-fingerprint-mismatch").exists());
}

#[test]
fn stale_same_identity_snapshot_without_fingerprint_cannot_acknowledge_install() {
    let (_root, library, game, staging, item) = fixture();
    let staged_skin = staging.join("skin-payload");
    fs::create_dir(&staged_skin).unwrap();
    fs::write(staged_skin.join("skin.blk"), b"valid skin").unwrap();
    let expected = SkinFingerprint::compute(&staged_skin).unwrap();
    let destination = game.join("UserSkins/TestSkin");
    prepare(&library, "tx-stale-fingerprint", item.clone(), "TestSkin", &destination, &staging, &game, 1, 10, false, Some(expected)).unwrap();
    fs::rename(&staged_skin, &destination).unwrap();
    fs::remove_dir_all(&staging).unwrap();
    finalize(&library, "tx-stale-fingerprint").unwrap();

    let stale = serde_json::json!({"favorites": [], "installedSkins": [{
        "availability": "present", "item": item, "folderName": "TestSkin", "path": destination,
        "fileCount": 1, "sizeBytes": 10, "installedAt": ""
    }], "externalSkinPublications": []});
    save_with_journal(&library, &stale).unwrap();
    assert!(entry_path(&library, "tx-stale-fingerprint").exists());

    let current = local_library::load(&library).unwrap().unwrap();
    assert!(current["installedSkins"][0].get("fingerprint").is_some());
    save_with_journal(&library, &current).unwrap();
    assert!(!entry_path(&library, "tx-stale-fingerprint").exists());
}
