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
