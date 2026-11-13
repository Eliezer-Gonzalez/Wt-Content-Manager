use super::duplicate_detection::DuplicateSkinCandidate;
use super::install_staging::PreparedSkinInstall;
use crate::AppError;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const MAX_PENDING_INSTALL_AGE: Duration = Duration::from_secs(15 * 60);

#[derive(Default, Clone)]
pub struct PreparedInstallRegistry {
    entries: Arc<Mutex<HashMap<String, (Instant, PreparedSkinInstall, Vec<DuplicateSkinCandidate>)>>>,
}

impl PreparedInstallRegistry {
    pub fn prune_expired(&self) -> Result<usize, AppError> {
        let mut entries = self.entries.lock().map_err(|_| AppError::new("skin_install_manager_unavailable"))?;
        let expired_ids = entries.iter()
            .filter_map(|(id, (created, _, _))| (created.elapsed() >= MAX_PENDING_INSTALL_AGE).then(|| id.clone()))
            .collect::<Vec<_>>();
        let expired = expired_ids.into_iter().filter_map(|id| entries.remove(&id)).collect::<Vec<_>>();
        let count = expired.len();
        drop(entries);
        drop(expired);
        Ok(count)
    }

    pub(super) fn insert(&self, id: String, prepared: PreparedSkinInstall, candidates: Vec<DuplicateSkinCandidate>) -> Result<(), AppError> {
        self.prune_expired()?;
        let mut entries = self.entries.lock().map_err(|_| AppError::new("skin_install_manager_unavailable"))?;
        if entries.contains_key(&id) { return Err(AppError::new("download_task_conflict")); }
        entries.insert(id, (Instant::now(), prepared, candidates));
        Ok(())
    }

    pub(super) fn take(&self, id: &str) -> Result<(PreparedSkinInstall, Vec<DuplicateSkinCandidate>), AppError> {
        self.prune_expired()?;
        let mut entries = self.entries.lock().map_err(|_| AppError::new("skin_install_manager_unavailable"))?;
        entries.remove(id).map(|(_, prepared, candidates)| (prepared, candidates)).ok_or_else(|| AppError::new("skin_pending_install_not_found"))
    }

    pub(super) fn cancel(&self, id: &str) -> Result<(), AppError> {
        let mut entries = self.entries.lock().map_err(|_| AppError::new("skin_install_manager_unavailable"))?;
        let removed = entries.remove(id).ok_or_else(|| AppError::new("skin_pending_install_not_found"))?;
        drop(entries);
        drop(removed);
        Ok(())
    }
}
