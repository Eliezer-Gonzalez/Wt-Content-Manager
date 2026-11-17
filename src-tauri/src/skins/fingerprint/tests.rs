use super::*;
use std::fs;

fn write_tree(root: &Path) {
    fs::create_dir_all(root.join("nested/deeper")).unwrap();
    fs::write(root.join("empty.bin"), b"").unwrap();
    fs::write(root.join("nested/deeper/texture.dds"), b"texture-bytes").unwrap();
}

#[test]
fn fingerprint_ignores_folder_name_and_absolute_path() {
    let first_root = tempfile::tempdir().unwrap();
    let second_root = tempfile::tempdir().unwrap();
    let first = first_root.path().join("first-name");
    let second = second_root.path().join("different-name");
    write_tree(&first);
    write_tree(&second);
    assert_eq!(
        SkinFingerprint::compute(&first).unwrap(),
        SkinFingerprint::compute(&second).unwrap()
    );
}

#[test]
fn changing_one_byte_changes_file_and_global_hashes() {
    let root = tempfile::tempdir().unwrap();
    let folder = root.path().join("skin");
    write_tree(&folder);
    let original = SkinFingerprint::compute(&folder).unwrap();
    fs::write(folder.join("nested/deeper/texture.dds"), b"texture-byteS").unwrap();
    let changed = SkinFingerprint::compute(&folder).unwrap();
    let original_file = original
        .files
        .iter()
        .find(|file| file.relative_path.ends_with("texture.dds"))
        .unwrap();
    let changed_file = changed
        .files
        .iter()
        .find(|file| file.relative_path.ends_with("texture.dds"))
        .unwrap();
    assert_ne!(original_file.hash, changed_file.hash);
    assert_ne!(original.global_hash, changed.global_hash);
}

#[test]
fn file_enumeration_order_does_not_change_global_hash() {
    let first = vec![
        ("z/file".to_string(), PathBuf::new()),
        ("a/file".to_string(), PathBuf::new()),
    ];
    let mut reversed = first.clone();
    reversed.reverse();
    let mut first = first;
    sort_paths(&mut first);
    sort_paths(&mut reversed);
    assert_eq!(
        first.iter().map(|file| &file.0).collect::<Vec<_>>(),
        reversed.iter().map(|file| &file.0).collect::<Vec<_>>()
    );
    let fingerprints = |paths: &[(String, PathBuf)]| {
        paths
            .iter()
            .map(|(relative_path, _)| SkinFingerprintFile {
                relative_path: relative_path.clone(),
                size_bytes: 3,
                hash: blake3::hash(relative_path.as_bytes()).to_hex().to_string(),
            })
            .collect::<Vec<_>>()
    };
    assert_eq!(
        hash_file_list(&fingerprints(&first)),
        hash_file_list(&fingerprints(&reversed))
    );
}

#[test]
fn empty_files_and_nested_directories_are_included() {
    let root = tempfile::tempdir().unwrap();
    let folder = root.path().join("skin");
    write_tree(&folder);
    let fingerprint = SkinFingerprint::compute(&folder).unwrap();
    assert_eq!(fingerprint.files.len(), 2);
    assert!(fingerprint
        .files
        .iter()
        .any(|file| file.relative_path == "empty.bin"
            && file.size_bytes == 0
            && file.hash == blake3::hash(b"").to_hex().to_string()));
    assert!(fingerprint
        .files
        .iter()
        .any(|file| file.relative_path == "nested/deeper/texture.dds"));
}

#[test]
fn same_content_at_different_relative_path_changes_global_hash() {
    let first_root = tempfile::tempdir().unwrap();
    let second_root = tempfile::tempdir().unwrap();
    let first = first_root.path().join("skin");
    let second = second_root.path().join("skin");
    fs::create_dir_all(&first).unwrap();
    fs::create_dir_all(&second).unwrap();
    fs::write(first.join("one.bin"), b"same").unwrap();
    fs::write(second.join("two.bin"), b"same").unwrap();
    assert_ne!(
        SkinFingerprint::compute(&first).unwrap().global_hash,
        SkinFingerprint::compute(&second).unwrap().global_hash
    );
}

#[test]
#[cfg(unix)]
fn symbolic_links_fail_instead_of_being_skipped_or_followed() {
    let root = tempfile::tempdir().unwrap();
    let folder = root.path().join("skin");
    fs::create_dir(&folder).unwrap();
    std::os::unix::fs::symlink(root.path().join("outside"), folder.join("link")).unwrap();
    assert_eq!(
        SkinFingerprint::compute(&folder).unwrap_err().kind(),
        io::ErrorKind::InvalidData
    );
}
