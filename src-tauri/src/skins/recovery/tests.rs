use super::recover_pending_replacements;
use crate::skins::staging::{
    cleanup_orphan_staging_with_threshold, inspect_orphan_staging_with_threshold,
};
use std::{fs, time::Duration};

use crate::skins::replacement::{ReplacementJournal, PREVIOUS_SKIN, REPLACEMENT_JOURNAL};

fn game_root() -> tempfile::TempDir {
    let game = tempfile::tempdir().unwrap();
    fs::create_dir(game.path().join("UserSkins")).unwrap();
    game
}

fn staging(game: &std::path::Path) -> std::path::PathBuf {
    let path = game.join(".wtcm-staging-1234567890abcdef");
    fs::create_dir(&path).unwrap();
    path
}

fn write_journal(path: &std::path::Path, journal: ReplacementJournal) {
    fs::write(
        path.join(REPLACEMENT_JOURNAL),
        serde_json::to_vec(&journal).unwrap(),
    )
    .unwrap();
}

fn prepared() -> ReplacementJournal {
    ReplacementJournal::Prepared {
        version: 1,
        folder_name: "F-16C".to_string(),
    }
}

fn committed() -> ReplacementJournal {
    ReplacementJournal::Committed {
        version: 1,
        folder_name: "F-16C".to_string(),
    }
}

#[test]
fn prepared_backup_is_restored_before_cleanup_and_recovery_is_idempotent() {
    let game = game_root();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    fs::create_dir(&backup).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    write_journal(&stage, prepared());

    let first = recover_pending_replacements(game.path()).unwrap();
    let second = recover_pending_replacements(game.path()).unwrap();

    assert!(first.protected.is_empty());
    assert!(second.protected.is_empty());
    assert!(game.path().join("UserSkins/F-16C/old.blk").exists());
    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();
    assert_eq!(outcome.removed_directories, 1);
    assert!(game.path().join("UserSkins/F-16C/old.blk").exists());
}

#[test]
fn ambiguous_backup_and_target_are_excluded_from_manual_and_automatic_cleanup() {
    let game = game_root();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    let target = game.path().join("UserSkins/F-16C");
    fs::create_dir(&backup).unwrap();
    fs::create_dir(&target).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    fs::write(target.join("new.blk"), b"new").unwrap();
    write_journal(&stage, prepared());

    let report = inspect_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();
    assert_eq!(report.directory_count, 0);
    assert_eq!(report.recovery_required_count, 1);
    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();
    assert_eq!(outcome.removed_directories, 0);
    assert_eq!(outcome.recovery_required_count, 1);
    assert!(backup.join("old.blk").exists());
    assert!(target.join("new.blk").exists());
    assert!(stage.exists());
}

#[test]
fn committed_transaction_cleans_backup_but_keeps_installed_skin() {
    let game = game_root();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    let target = game.path().join("UserSkins/F-16C");
    fs::create_dir(&backup).unwrap();
    fs::create_dir(&target).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    fs::write(target.join("new.blk"), b"new").unwrap();
    write_journal(&stage, committed());

    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();

    assert_eq!(outcome.removed_directories, 1);
    assert!(!stage.exists());
    assert!(target.join("new.blk").exists());
}

#[test]
fn malformed_and_legacy_backups_are_preserved() {
    let game = game_root();
    let malformed = staging(game.path());
    fs::create_dir(malformed.join(PREVIOUS_SKIN)).unwrap();
    fs::write(malformed.join(REPLACEMENT_JOURNAL), b"not json").unwrap();
    let legacy = game.path().join(".wtcm-staging-abcdef1234567890");
    fs::create_dir(&legacy).unwrap();
    fs::create_dir(legacy.join(PREVIOUS_SKIN)).unwrap();

    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();

    assert_eq!(outcome.removed_directories, 0);
    assert_eq!(outcome.recovery_required_count, 2);
    assert!(malformed.exists());
    assert!(legacy.exists());
}

#[test]
fn journal_folder_names_cannot_escape_userskins() {
    let game = game_root();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    fs::create_dir(&backup).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    write_journal(
        &stage,
        ReplacementJournal::Prepared {
            version: 1,
            folder_name: "..\\outside".to_string(),
        },
    );

    let summary = recover_pending_replacements(game.path()).unwrap();

    assert_eq!(summary.protected.len(), 1);
    assert!(backup.join("old.blk").exists());
    assert!(!game.path().join("outside").exists());
}

#[test]
fn backup_is_preserved_when_userskins_is_missing() {
    let game = tempfile::tempdir().unwrap();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    fs::create_dir(&backup).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    write_journal(&stage, prepared());

    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();

    assert_eq!(outcome.removed_directories, 0);
    assert_eq!(outcome.recovery_required_count, 1);
    assert!(backup.join("old.blk").exists());
}

#[test]
fn unsupported_journal_version_is_kept_for_manual_recovery() {
    let game = game_root();
    let stage = staging(game.path());
    let backup = stage.join(PREVIOUS_SKIN);
    fs::create_dir(&backup).unwrap();
    fs::write(backup.join("old.blk"), b"old").unwrap();
    write_journal(
        &stage,
        ReplacementJournal::Prepared {
            version: 99,
            folder_name: "F-16C".to_string(),
        },
    );

    let outcome = cleanup_orphan_staging_with_threshold(game.path(), Duration::ZERO).unwrap();

    assert_eq!(outcome.recovery_required_count, 1);
    assert!(backup.join("old.blk").exists());
}
