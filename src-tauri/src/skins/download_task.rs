use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use crate::AppError;

const PREPARING: u8 = 0;
const DOWNLOADING: u8 = 1;
const EXTRACTING: u8 = 2;

#[derive(Default)]
pub struct DownloadManager {
    tasks: Mutex<HashMap<String, Arc<DownloadControl>>>,
}

pub struct DownloadControl {
    cancelled: AtomicBool,
    paused: AtomicBool,
    phase: AtomicU8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinInstallProgress {
    pub phase: &'static str,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub paused: bool,
}

impl DownloadManager {
    pub fn register(&self, task_id: &str) -> Result<Arc<DownloadControl>, AppError> {
        if task_id.is_empty()
            || task_id.len() > 64
            || !task_id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-')
        {
            return Err(AppError::new("download_task_invalid"));
        }
        let mut tasks = self
            .tasks
            .lock()
            .map_err(|_| AppError::new("download_manager_unavailable"))?;
        if tasks.contains_key(task_id) {
            return Err(AppError::new("download_task_conflict"));
        }
        let control = Arc::new(DownloadControl {
            cancelled: AtomicBool::new(false),
            paused: AtomicBool::new(false),
            phase: AtomicU8::new(PREPARING),
        });
        tasks.insert(task_id.to_string(), Arc::clone(&control));
        Ok(control)
    }

    pub fn set_paused(&self, task_id: &str, paused: bool) -> Result<(), AppError> {
        let control = self.get(task_id)?;
        control.ensure_downloading()?;
        control.paused.store(paused, Ordering::SeqCst);
        Ok(())
    }

    pub fn cancel(&self, task_id: &str) -> Result<(), AppError> {
        let control = self.get(task_id)?;
        control.ensure_downloading()?;
        control.cancelled.store(true, Ordering::SeqCst);
        control.paused.store(false, Ordering::SeqCst);
        Ok(())
    }

    pub fn finish(&self, task_id: &str) {
        if let Ok(mut tasks) = self.tasks.lock() {
            tasks.remove(task_id);
        }
    }

    fn get(&self, task_id: &str) -> Result<Arc<DownloadControl>, AppError> {
        self.tasks
            .lock()
            .map_err(|_| AppError::new("download_manager_unavailable"))?
            .get(task_id)
            .cloned()
            .ok_or_else(|| AppError::new("download_task_not_found"))
    }
}

impl DownloadControl {
    pub fn begin_download(&self) {
        self.phase.store(DOWNLOADING, Ordering::SeqCst);
    }

    pub fn begin_extraction(&self) {
        self.phase.store(EXTRACTING, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn check_cancelled(&self) -> Result<(), AppError> {
        if self.cancelled.load(Ordering::SeqCst) {
            Err(AppError::new("download_cancelled"))
        } else {
            Ok(())
        }
    }

    fn ensure_downloading(&self) -> Result<(), AppError> {
        if self.phase.load(Ordering::SeqCst) != DOWNLOADING {
            return Err(AppError::new("download_control_unavailable"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::DownloadManager;

    #[test]
    fn pause_and_cancel_are_only_available_while_downloading() {
        let manager = DownloadManager::default();
        let control = manager.register("test-task").unwrap();
        assert!(manager.set_paused("test-task", true).is_err());

        control.begin_download();
        manager.set_paused("test-task", true).unwrap();
        assert!(control.is_paused());
        manager.cancel("test-task").unwrap();
        assert!(!control.is_paused());
        assert!(control.check_cancelled().is_err());

        control.begin_extraction();
        assert!(manager.cancel("test-task").is_err());
        manager.finish("test-task");
        assert!(manager.set_paused("test-task", false).is_err());
    }
}
