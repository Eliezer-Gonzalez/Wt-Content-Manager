use super::{replace_skin_folder, replace_skin_folder_with, PREVIOUS_SKIN};
use std::fs;
use tempfile::TempDir;

fn setup() -> (
    TempDir,
    std::path::PathBuf,
    std::path::PathBuf,
    std::path::PathBuf,
) {
    let game = tempfile::tempdir().unwrap();
    let userskins = game.path().join("UserSkins");
    let staging = game.path().join(".wtcm-staging-1234567890abcdef");
    let replacement = staging.join("payload").join("new-skin");
    let existing = userskins.join("F-16C");
    fs::create_dir_all(&existing).unwrap();
    fs::create_dir_all(&replacement).unwrap();
    fs::write(existing.join("old.blk"), b"old").unwrap();
    fs::write(replacement.join("new.blk"), b"new").unwrap();
    (game, userskins, staging, replacement)
}

#[test]
fn replacement_commits_journal_after_installing_new_skin() {
    let (_game, userskins, staging, replacement) = setup();
    let existing = userskins.join("F-16C");

    replace_skin_folder(&userskins, "F-16C", &replacement, &staging).unwrap();

    assert!(existing.join("new.blk").exists());
    assert!(staging.join(PREVIOUS_SKIN).join("old.blk").exists());
    let journal = fs::read_to_string(staging.join(super::REPLACEMENT_JOURNAL)).unwrap();
    assert!(journal.contains("committed"));
}

#[test]
fn failed_replacement_restores_old_skin_when_rollback_succeeds() {
    let (_game, userskins, staging, replacement) = setup();
    let existing = userskins.join("F-16C");
    let mut rename_count = 0;

    let failure =
        replace_skin_folder_with(&userskins, "F-16C", &replacement, &staging, |from, to| {
            rename_count += 1;
            if rename_count == 2 {
                return Err(std::io::Error::other("injected replacement failure"));
            }
            fs::rename(from, to)
        })
        .unwrap_err();

    assert_eq!(failure.error.code, "skin_save_failed");
    assert!(!failure.preserve_staging);
    assert!(existing.join("old.blk").exists());
    assert!(!staging.join(PREVIOUS_SKIN).exists());
}

#[test]
fn failed_rollback_marks_staging_for_preservation() {
    let (_game, userskins, staging, replacement) = setup();
    let existing = userskins.join("F-16C");
    let mut rename_count = 0;

    let failure =
        replace_skin_folder_with(&userskins, "F-16C", &replacement, &staging, |from, to| {
            rename_count += 1;
            if rename_count >= 2 {
                return Err(std::io::Error::other("injected rename failure"));
            }
            fs::rename(from, to)
        })
        .unwrap_err();

    assert_eq!(failure.error.code, "skin_recovery_required");
    assert!(failure.preserve_staging);
    assert!(staging.join(PREVIOUS_SKIN).join("old.blk").exists());
    assert!(!existing.exists());
}

#[test]
fn failed_commit_record_preserves_both_skins_for_recovery() {
    let (_game, userskins, staging, replacement) = setup();
    let existing = userskins.join("F-16C");
    fs::create_dir(staging.join("replacement.json.tmp")).unwrap();

    let failure = replace_skin_folder(&userskins, "F-16C", &replacement, &staging).unwrap_err();

    assert_eq!(failure.error.code, "skin_recovery_required");
    assert!(failure.preserve_staging);
    assert!(existing.join("new.blk").exists());
    assert!(staging.join(PREVIOUS_SKIN).join("old.blk").exists());
}
