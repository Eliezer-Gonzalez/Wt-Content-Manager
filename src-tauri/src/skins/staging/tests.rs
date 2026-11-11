use super::{
    cleanup_orphan_staging_with_threshold, inspect_orphan_staging_with_threshold,
    is_orphan_staging_dir, register_active_staging, unregister_active_staging,
};
use std::fs;
use std::time::Duration;

#[test]
fn prefix_matching_strictly_identifies_app_staging_dirs() {
    // Exactly prefix + 16 alphanumeric characters
    assert!(is_orphan_staging_dir(".wtcm-staging-1234567890abcdef"));
    assert!(is_orphan_staging_dir(".wtcm-staging-ABCDEFGHIJKLMNOP"));

    // Wrong suffix length
    assert!(!is_orphan_staging_dir(".wtcm-staging-abc123"));
    assert!(!is_orphan_staging_dir(
        ".wtcm-staging-1234567890abcdeftoolong"
    ));
    assert!(!is_orphan_staging_dir(".wtcm-staging-"));

    // Invalid characters (e.g. symbols, underscores)
    assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcde_"));
    assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcde-"));

    // Unrelated folders
    assert!(!is_orphan_staging_dir("wtcm-my-skin"));
    assert!(!is_orphan_staging_dir("wtcm-12345"));
    assert!(!is_orphan_staging_dir("UserSkins"));
    assert!(!is_orphan_staging_dir("content"));
}

#[test]
fn cleanup_orphans_respects_active_age_and_strict_naming() {
    let temp = tempfile::tempdir().unwrap();
    let game_root = temp.path().join("game");
    let userskins = game_root.join("UserSkins");
    fs::create_dir_all(&userskins).unwrap();

    // 1. Unrelated folders
    let content_dir = game_root.join("content");
    fs::create_dir(&content_dir).unwrap();
    let my_skin_dir = userskins.join("MySkin");
    fs::create_dir(&my_skin_dir).unwrap();

    // 2. Skin folder named like "wtcm-my-skin" (in UserSkins and game_root)
    let wtcm_skin_in_userskins = userskins.join("wtcm-my-skin");
    fs::create_dir(&wtcm_skin_in_userskins).unwrap();
    let wtcm_dir_in_game_root = game_root.join("wtcm-my-skin");
    fs::create_dir(&wtcm_dir_in_game_root).unwrap();

    // 3. Staging dir matching strict format (.wtcm-staging-1234567890abcdef)
    let old_orphan = game_root.join(".wtcm-staging-1234567890abcdef");
    fs::create_dir(&old_orphan).unwrap();

    // 4. Fresh matching dir
    let fresh_staging = game_root.join(".wtcm-staging-abcdef1234567890");
    fs::create_dir(&fresh_staging).unwrap();

    // 5. Active registered staging dir
    let active_staging = game_root.join(".wtcm-staging-active1234567890");
    fs::create_dir(&active_staging).unwrap();
    register_active_staging(active_staging.clone());

    // First pass: with 10-minute threshold
    // - fresh_staging was just created, elapsed < 10m -> NOT deleted
    // - active_staging is registered -> NOT deleted
    // - old_orphan was just created, elapsed < 10m -> NOT deleted
    cleanup_orphan_staging_with_threshold(&game_root, Duration::from_secs(600)).unwrap();
    assert!(
        fresh_staging.exists(),
        "fresh matching dir should not be deleted"
    );
    assert!(
        active_staging.exists(),
        "active staging dir should not be deleted"
    );
    assert!(
        old_orphan.exists(),
        "young dir should not be deleted with 10m threshold"
    );

    // Second pass: with Duration::ZERO (simulating old age >= threshold)
    // - old_orphan is matching and not active -> DELETED
    // - active_staging is registered -> NOT deleted even with threshold 0
    // - wtcm-my-skin, content, UserSkins, MySkin -> NOT deleted
    cleanup_orphan_staging_with_threshold(&game_root, Duration::ZERO).unwrap();
    assert!(!old_orphan.exists(), "old matching dir should be deleted");
    assert!(
        active_staging.exists(),
        "active staging dir must stay even with 0 threshold"
    );
    assert!(
        wtcm_skin_in_userskins.exists(),
        "wtcm-my-skin in UserSkins must stay"
    );
    assert!(
        wtcm_dir_in_game_root.exists(),
        "wtcm-my-skin in game_root must stay"
    );
    assert!(content_dir.exists(), "content dir must stay");
    assert!(userskins.exists(), "UserSkins dir must stay");
    assert!(my_skin_dir.exists(), "MySkin in UserSkins must stay");

    // Clean up active registry
    unregister_active_staging(&active_staging);
}

#[test]
fn reports_and_cleans_only_eligible_staging_directories() {
    let temp = tempfile::tempdir().unwrap();
    let game_root = temp.path().join("game");
    let userskins = game_root.join("UserSkins");
    fs::create_dir_all(&userskins).unwrap();
    let skin = userskins.join("MySkin");
    fs::create_dir(&skin).unwrap();
    fs::write(skin.join("skin.blk"), b"installed skin").unwrap();

    let orphan = game_root.join(".wtcm-staging-1234567890abcdef");
    fs::create_dir(&orphan).unwrap();
    fs::write(orphan.join("download.zip"), b"temporary archive").unwrap();
    let active = game_root.join(".wtcm-staging-abcdef1234567890");
    fs::create_dir(&active).unwrap();
    fs::write(active.join("in-progress.zip"), b"active").unwrap();
    register_active_staging(active.clone());

    let report = inspect_orphan_staging_with_threshold(&game_root, Duration::ZERO).unwrap();
    assert_eq!(report.directory_count, 1);
    assert_eq!(report.total_bytes, b"temporary archive".len() as u64);

    let outcome = cleanup_orphan_staging_with_threshold(&game_root, Duration::ZERO).unwrap();
    assert_eq!(outcome.removed_directories, 1);
    assert_eq!(outcome.freed_bytes, b"temporary archive".len() as u64);
    assert_eq!(outcome.failed_directories, 0);
    assert!(!orphan.exists());
    assert!(active.exists());
    assert!(skin.join("skin.blk").exists());
    unregister_active_staging(&active);
}
