use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_LOG_BYTES: u64 = 1024 * 1024;
const MAX_RECENT_BYTES: u64 = 96 * 1024;

#[derive(Clone)]
pub struct DiagnosticLogger {
    state: Arc<Mutex<LoggerState>>,
}

#[derive(Default)]
struct LoggerState {
    directory: Option<PathBuf>,
    enabled: bool,
}

#[derive(Serialize, Deserialize)]
struct LoggerConfig {
    enabled: bool,
}

#[derive(Serialize)]
struct LogRecord<'a> {
    timestamp_ms: u128,
    level: &'a str,
    source: &'a str,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSettings {
    pub enabled: bool,
    pub has_logs: bool,
    pub directory: String,
}

impl Default for DiagnosticLogger {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(LoggerState {
                directory: None,
                enabled: true,
            })),
        }
    }
}

impl DiagnosticLogger {
    fn lock(&self) -> MutexGuard<'_, LoggerState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn initialize(&self, directory: &Path) -> Result<(), String> {
        fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        let config_path = directory.join("settings.json");
        let enabled = fs::read(&config_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<LoggerConfig>(&bytes).ok())
            .map(|config| config.enabled)
            .unwrap_or(true);
        {
            let mut state = self.lock();
            state.directory = Some(directory.to_path_buf());
            state.enabled = enabled;
        }
        if !config_path.exists() {
            Self::save_config(&config_path, enabled)?;
        }
        self.write("info", "application", "started")
    }

    pub fn settings(&self) -> Result<DiagnosticSettings, String> {
        let state = self.lock();
        let directory = state
            .directory
            .as_ref()
            .ok_or_else(|| "Diagnostic logging is not initialized.".to_string())?;
        Ok(DiagnosticSettings {
            enabled: state.enabled,
            has_logs: directory.join("diagnostics.log").is_file(),
            directory: directory.to_string_lossy().into_owned(),
        })
    }

    pub fn directory(&self) -> Result<PathBuf, String> {
        self.lock()
            .directory
            .clone()
            .ok_or_else(|| "Diagnostic logging is not initialized.".to_string())
    }

    pub fn set_enabled(&self, enabled: bool) -> Result<(), String> {
        let (directory, current) = {
            let state = self.lock();
            (
                state
                    .directory
                    .clone()
                    .ok_or_else(|| "Diagnostic logging is not initialized.".to_string())?,
                state.enabled,
            )
        };
        if current == enabled {
            return Ok(());
        }
        if !enabled {
            self.write("info", "settings", "diagnostic logging disabled")?;
        }
        Self::save_config(&directory.join("settings.json"), enabled)?;
        self.lock().enabled = enabled;
        if enabled {
            self.write("info", "settings", "diagnostic logging enabled")?;
        }
        Ok(())
    }

    pub fn write(&self, level: &str, source: &str, message: &str) -> Result<(), String> {
        let state = self.lock();
        if !state.enabled {
            return Ok(());
        }
        let directory = state
            .directory
            .as_ref()
            .ok_or_else(|| "Diagnostic logging is not initialized.".to_string())?;
        let path = directory.join("diagnostics.log");
        rotate_if_needed(&path)?;
        let source = sanitize(source, 80);
        let message = sanitize(&redact_user_directory(message), 2_000);
        let record = LogRecord {
            timestamp_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            level: if matches!(level, "warn" | "error") {
                level
            } else {
                "info"
            },
            source: &source,
            message,
        };
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|error| error.to_string())?;
        serde_json::to_writer(&mut file, &record).map_err(|error| error.to_string())?;
        file.write_all(b"\n").map_err(|error| error.to_string())?;
        file.sync_data().map_err(|error| error.to_string())
    }

    pub fn read_recent(&self) -> Result<String, String> {
        let state = self.lock();
        let directory = state
            .directory
            .as_ref()
            .ok_or_else(|| "Diagnostic logging is not initialized.".to_string())?;
        let path = directory.join("diagnostics.log");
        let mut file = match File::open(path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(String::new()),
            Err(error) => return Err(error.to_string()),
        };
        let file_size = file.metadata().map_err(|error| error.to_string())?.len();
        let offset = file_size.saturating_sub(MAX_RECENT_BYTES);
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| error.to_string())?;
        let mut bytes = Vec::with_capacity(file_size.min(MAX_RECENT_BYTES) as usize);
        file.take(MAX_RECENT_BYTES)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        let start = if offset == 0 {
            0
        } else {
            bytes
                .iter()
                .position(|byte| *byte == b'\n')
                .map_or(0, |offset| offset + 1)
        };
        Ok(String::from_utf8_lossy(&bytes[start..]).into_owned())
    }

    fn save_config(path: &Path, enabled: bool) -> Result<(), String> {
        let temp_path = path.with_extension("tmp");
        let bytes =
            serde_json::to_vec(&LoggerConfig { enabled }).map_err(|error| error.to_string())?;
        fs::write(&temp_path, bytes).map_err(|error| error.to_string())?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        fs::rename(temp_path, path).map_err(|error| error.to_string())
    }
}

fn rotate_if_needed(path: &Path) -> Result<(), String> {
    if !path
        .metadata()
        .is_ok_and(|metadata| metadata.len() >= MAX_LOG_BYTES)
    {
        return Ok(());
    }
    let first_backup = path.with_extension("log.1");
    let second_backup = path.with_extension("log.2");
    if second_backup.exists() {
        fs::remove_file(&second_backup).map_err(|error| error.to_string())?;
    }
    if first_backup.exists() {
        fs::rename(&first_backup, &second_backup).map_err(|error| error.to_string())?;
    }
    fs::rename(path, first_backup).map_err(|error| error.to_string())
}

fn sanitize(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .filter(|character| !character.is_control() || *character == '\t')
        .take(max_chars)
        .collect()
}

fn redact_user_directory(value: &str) -> String {
    ["USERPROFILE", "HOME"]
        .iter()
        .filter_map(|key| std::env::var(key).ok())
        .filter(|home| !home.is_empty())
        .fold(value.to_string(), |message, home| {
            message.replace(&home, "%USERPROFILE%")
        })
}

#[cfg(test)]
mod tests {
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
}
