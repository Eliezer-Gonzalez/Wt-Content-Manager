use super::DiagnosticLogger;

#[test]
fn logging_defaults_on_and_setting_persists_after_restart() {
    let directory = tempfile::tempdir().unwrap();
    let logger = DiagnosticLogger::default();
    logger.initialize(directory.path()).unwrap();
    assert!(logger.settings().unwrap().enabled);

    logger.set_enabled(false).unwrap();
    let restarted = DiagnosticLogger::default();
    restarted.initialize(directory.path()).unwrap();
    assert!(!restarted.settings().unwrap().enabled);
}

#[test]
fn disabled_logging_does_not_append_new_records() {
    let directory = tempfile::tempdir().unwrap();
    let logger = DiagnosticLogger::default();
    logger.initialize(directory.path()).unwrap();
    logger.set_enabled(false).unwrap();
    let existing = logger.read_recent().unwrap();
    logger.write("error", "test", "must not persist").unwrap();
    assert_eq!(logger.read_recent().unwrap(), existing);
}

#[test]
fn records_are_local_json_lines_with_user_directory_redacted() {
    let directory = tempfile::tempdir().unwrap();
    let logger = DiagnosticLogger::default();
    logger.initialize(directory.path()).unwrap();
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    logger
        .write("error", "download", &format!("failed under {home}"))
        .unwrap();
    let recent = logger.read_recent().unwrap();
    assert!(recent.contains("\"level\":\"error\""));
    assert!(recent.contains("\"source\":\"download\""));
    if !home.is_empty() {
        assert!(recent.contains("%USERPROFILE%"));
        assert!(!recent.contains(&home));
    }
}

#[test]
fn rotates_logs_at_the_configured_size_and_keeps_two_backups() {
    let directory = tempfile::tempdir().unwrap();
    let logger = DiagnosticLogger::default();
    logger.initialize(directory.path()).unwrap();
    let log_path = directory.path().join("diagnostics.log");
    std::fs::write(&log_path, vec![b'x'; super::MAX_LOG_BYTES as usize]).unwrap();
    std::fs::write(directory.path().join("diagnostics.log.1"), "older backup").unwrap();

    logger.write("error", "test", "after rotation").unwrap();

    assert!(directory.path().join("diagnostics.log.1").is_file());
    assert!(directory.path().join("diagnostics.log.2").is_file());
    assert!(std::fs::metadata(&log_path).unwrap().len() < super::MAX_LOG_BYTES);
}
