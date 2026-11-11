use super::load_or_create_state;
use crate::sounds::{journal, types::ExistingSoundModAction};
use std::fs;
use tempfile::tempdir_in;

fn writable_tempdir() -> tempfile::TempDir {
    let target_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("target");
    fs::create_dir_all(&target_dir).unwrap();
    tempdir_in(target_dir).unwrap()
}

#[test]
fn first_install_requires_explicit_choice_for_existing_content() {
    let temp = writable_tempdir();
    let game_root = temp.path().join("game");
    let target = game_root.join("sound/mod");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("original.bank"), b"original").unwrap();
    let paths = journal::storage_paths(&temp.path().join("app"), &game_root);

    let result = load_or_create_state(&paths, &game_root, &target, None);

    assert_eq!(
        result.unwrap_err().code,
        "sound_existing_mod_decision_required"
    );
    assert!(journal::read_state(&paths).unwrap().is_none());
    assert!(target.join("original.bank").is_file());
}

#[test]
fn backup_choice_preserves_original_and_later_install_does_not_replace_it() {
    let temp = writable_tempdir();
    let game_root = temp.path().join("game");
    let target = game_root.join("sound/mod");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("original.bank"), b"original").unwrap();
    let paths = journal::storage_paths(&temp.path().join("app"), &game_root);

    let first = load_or_create_state(
        &paths,
        &game_root,
        &target,
        Some(ExistingSoundModAction::Backup),
    )
    .unwrap();
    fs::write(target.join("managed.bank"), b"managed").unwrap();
    let next = load_or_create_state(
        &paths,
        &game_root,
        &target,
        Some(ExistingSoundModAction::Delete),
    )
    .unwrap();

    assert!(first.original_existed);
    assert!(next.original_existed);
    assert_eq!(
        fs::read(paths.original_backup.join("original.bank")).unwrap(),
        b"original"
    );
    assert!(!paths.original_backup.join("managed.bank").exists());
}

#[test]
fn delete_choice_does_not_create_a_restore_copy() {
    let temp = writable_tempdir();
    let game_root = temp.path().join("game");
    let target = game_root.join("sound/mod");
    fs::create_dir_all(&target).unwrap();
    fs::write(target.join("external.bank"), b"external").unwrap();
    let paths = journal::storage_paths(&temp.path().join("app"), &game_root);

    let state = load_or_create_state(
        &paths,
        &game_root,
        &target,
        Some(ExistingSoundModAction::Delete),
    )
    .unwrap();

    assert!(!state.original_existed);
    assert!(!paths.original_backup.exists());
}
