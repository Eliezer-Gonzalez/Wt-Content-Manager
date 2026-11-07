use std::path::{Path, PathBuf};

pub const STAGING_PREFIX: &str = ".wtcm-staging-";
pub const STAGING_SUFFIX_LEN: usize = 16;
pub const DEFAULT_ORPHAN_AGE_THRESHOLD: std::time::Duration =
    std::time::Duration::from_secs(10 * 60);

static ACTIVE_STAGING_DIRS: std::sync::Mutex<Option<std::collections::HashSet<PathBuf>>> =
    std::sync::Mutex::new(None);

pub fn register_active_staging(path: PathBuf) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        lock.get_or_insert_with(std::collections::HashSet::new)
            .insert(path);
    }
}

pub fn unregister_active_staging(path: &Path) {
    if let Ok(mut lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_mut() {
            set.remove(path);
        }
    }
}

pub fn is_active_staging(path: &Path) -> bool {
    if let Ok(lock) = ACTIVE_STAGING_DIRS.lock() {
        if let Some(set) = lock.as_ref() {
            return set.contains(path);
        }
    }
    false
}

pub fn is_orphan_staging_dir(name: &str) -> bool {
    let Some(suffix) = name.strip_prefix(STAGING_PREFIX) else {
        return false;
    };
    suffix.len() == STAGING_SUFFIX_LEN && suffix.chars().all(|c| c.is_ascii_alphanumeric())
}

pub fn cleanup_orphans(game_root: &Path) {
    cleanup_orphans_with_threshold(game_root, DEFAULT_ORPHAN_AGE_THRESHOLD);
}

pub fn cleanup_orphans_with_threshold(game_root: &Path, age_threshold: std::time::Duration) {
    let Ok(entries) = std::fs::read_dir(game_root) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();
        if !is_orphan_staging_dir(&name_str) {
            continue;
        }

        let entry_path = entry.path();
        if is_active_staging(&entry_path) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            if let Ok(modified) = metadata.modified() {
                match modified.elapsed() {
                    Ok(elapsed) if elapsed < age_threshold => {
                        continue;
                    }
                    Err(_) => {
                        continue;
                    }
                    _ => {}
                }
            }
        }

        let _ = std::fs::remove_dir_all(&entry_path);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        cleanup_orphans_with_threshold, is_orphan_staging_dir, register_active_staging,
        unregister_active_staging,
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
        assert!(!is_orphan_staging_dir(".wtcm-staging-1234567890abcdeftoolong"));
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
        cleanup_orphans_with_threshold(&game_root, Duration::from_secs(600));
        assert!(fresh_staging.exists(), "fresh matching dir should not be deleted");
        assert!(active_staging.exists(), "active staging dir should not be deleted");
        assert!(old_orphan.exists(), "young dir should not be deleted with 10m threshold");

        // Second pass: with Duration::ZERO (simulating old age >= threshold)
        // - old_orphan is matching and not active -> DELETED
        // - active_staging is registered -> NOT deleted even with threshold 0
        // - wtcm-my-skin, content, UserSkins, MySkin -> NOT deleted
        cleanup_orphans_with_threshold(&game_root, Duration::ZERO);
        assert!(!old_orphan.exists(), "old matching dir should be deleted");
        assert!(active_staging.exists(), "active staging dir must stay even with 0 threshold");
        assert!(wtcm_skin_in_userskins.exists(), "wtcm-my-skin in UserSkins must stay");
        assert!(wtcm_dir_in_game_root.exists(), "wtcm-my-skin in game_root must stay");
        assert!(content_dir.exists(), "content dir must stay");
        assert!(userskins.exists(), "UserSkins dir must stay");
        assert!(my_skin_dir.exists(), "MySkin in UserSkins must stay");

        // Clean up active registry
        unregister_active_staging(&active_staging);
    }
}
