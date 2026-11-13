use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use crate::AppError;

const PREPARING: u8 = 0;
const DOWNLOADING: u8 = 1;
const EXTRACTING: u8 = 2;
const COMPARING: u8 = 3;

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
        control.ensure_pauseable()?;
        control.paused.store(paused, Ordering::SeqCst);
        Ok(())
    }

    pub fn cancel(&self, task_id: &str) -> Result<(), AppError> {
        let control = self.get(task_id)?;
        control.ensure_cancellable()?;
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

    pub fn begin_comparison(&self) {
        self.phase.store(COMPARING, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub async fn wait_until_resumed(&self) -> Result<(), AppError> {
        while self.is_paused() {
            self.check_cancelled()?;
            tokio::time::sleep(std::time::Duration::from_millis(120)).await;
        }
        self.check_cancelled()
    }

    pub fn wait_until_resumed_blocking(&self) -> Result<(), AppError> {
        while self.is_paused() {
            self.check_cancelled()?;
            std::thread::sleep(std::time::Duration::from_millis(120));
        }
        self.check_cancelled()
    }

    pub fn check_cancelled(&self) -> Result<(), AppError> {
        if self.cancelled.load(Ordering::SeqCst) {
            Err(AppError::new("download_cancelled"))
        } else {
            Ok(())
        }
    }

    fn ensure_pauseable(&self) -> Result<(), AppError> {
        if matches!(self.phase.load(Ordering::SeqCst), DOWNLOADING | COMPARING) {
            Ok(())
        } else {
            Err(AppError::new("download_control_unavailable"))
        }
    }

    fn ensure_cancellable(&self) -> Result<(), AppError> {
        if matches!(self.phase.load(Ordering::SeqCst), DOWNLOADING | COMPARING) {
            Ok(())
        } else {
            Err(AppError::new("download_control_unavailable"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::DownloadManager;
    use std::sync::Arc;

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

    #[tokio::test]
    async fn wait_until_resumed_stays_paused_and_stops_when_cancelled() {
        let manager = DownloadManager::default();
        let control = manager.register("wait-task").unwrap();
        control.begin_download();
        manager.set_paused("wait-task", true).unwrap();

        let waiting_control = Arc::clone(&control);
        let waiting = tokio::spawn(async move { waiting_control.wait_until_resumed().await });
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        assert!(!waiting.is_finished());

        manager.set_paused("wait-task", false).unwrap();
        assert!(waiting.await.unwrap().is_ok());

        manager.set_paused("wait-task", true).unwrap();
        let waiting_control = Arc::clone(&control);
        let waiting = tokio::spawn(async move { waiting_control.wait_until_resumed().await });
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        manager.cancel("wait-task").unwrap();
        assert_eq!(
            waiting.await.unwrap().unwrap_err().code,
            "download_cancelled"
        );
    }
}
