use super::*;
use std::fs;

fn temp_app() -> tempfile::TempDir {
    let target = Path::new(env!("CARGO_MANIFEST_DIR")).join("target");
    fs::create_dir_all(&target).unwrap();
    tempfile::tempdir_in(target).unwrap()
}

fn package(id: &str, revision: u64, archive_name: &str) -> SoundPackage {
    SoundPackage {
        id: id.to_owned(),
        lang_group: 123,
        title: "Test sound".to_owned(),
        author: "Tester".to_owned(),
        archive_name: archive_name.to_owned(),
        size_bytes: 4,
        downloaded_at: revision + 1,
        revision,
        file_count: Some(1),
    }
}

fn create_package(app: &Path, package: &SoundPackage, bytes: &[u8]) -> PathBuf {
    let directory = library::package_path(app, &package.id).unwrap();
    fs::create_dir_all(&directory).unwrap();
    fs::write(directory.join("source.zip"), bytes).unwrap();
    library::write_package_manifest(&directory, package).unwrap();
    directory
}

#[test]
fn update_replaces_archive_and_manifest_without_changing_package_id() {
    let temp = temp_app();
    let app = temp.path().join("app");
    let old = package("123-1", 0, "old.zip");
    let target = create_package(&app, &old, b"old!");
    recover_pending_locked(&app).unwrap();
    let stage = update_root(&app).join("stage-test");
    fs::create_dir_all(&stage).unwrap();
    fs::write(stage.join("source.zip"), b"new!").unwrap();

    let updated = commit_update(&app, &package("123-1", 1, "new.zip"), 0, "stage-test").unwrap();

    assert_eq!(updated.id, old.id);
    assert_eq!(library::read_package(&app, "123-1").unwrap().revision, 1);
    assert_eq!(fs::read(target.join("source.zip")).unwrap(), b"new!");
    assert_eq!(library::list_packages(&app).unwrap().len(), 1);
}

#[test]
fn recovery_rolls_back_interrupted_uncommitted_swap() {
    let temp = temp_app();
    let app = temp.path().join("app");
    let old = package("123-1", 0, "old.zip");
    let target = create_package(&app, &old, b"old!");
    let root = update_root(&app);
    let stage = root.join("stage-test");
    let backup = root.join("backup-test");
    fs::create_dir_all(&stage).unwrap();
    fs::write(stage.join("source.zip"), b"new!").unwrap();
    fs::rename(&target, &backup).unwrap();
    write_journal(
        &root,
        &UpdateJournal {
            package_id: old.id.clone(),
            expected_revision: 0,
            stage_name: "stage-test".to_owned(),
            backup_name: "backup-test".to_owned(),
        },
    )
    .unwrap();

    recover_pending_locked(&app).unwrap();

    assert_eq!(library::read_package(&app, "123-1").unwrap().revision, 0);
    assert!(!stage.exists());
    assert!(!read_journal(&root).unwrap().is_some());
}

#[test]
fn startup_cleanup_removes_abandoned_stages_without_touching_packages() {
    let temp = temp_app();
    let app = temp.path().join("app");
    let update_root = update_root(&app);
    let abandoned = update_root.join("stage-abandoned");
    fs::create_dir_all(&abandoned).unwrap();
    fs::write(abandoned.join("source.part"), b"partial").unwrap();
    fs::create_dir_all(update_root.join("backup-kept")).unwrap();

    cleanup_orphaned_stages_once(&update_root).unwrap();

    assert!(!abandoned.exists());
    assert!(update_root.join("backup-kept").is_dir());
}
