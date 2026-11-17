use crate::AppError;
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    Arc, Mutex, OnceLock,
};

static TASKS: OnceLock<Mutex<HashMap<String, Arc<RepairTaskControl>>>> = OnceLock::new();

pub(crate) struct RepairTaskControl {
    cancelled: AtomicBool,
    phase: AtomicU8,
}

impl RepairTaskControl {
    pub(crate) fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub(crate) fn cancellation_flag(&self) -> &AtomicBool {
        &self.cancelled
    }

    pub(crate) fn begin_finalizing(&self) -> Result<(), AppError> {
        self.phase
            .compare_exchange(0, 2, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| ())
            .map_err(|_| AppError::new("download_cancelled"))
    }
}

pub(crate) fn register_task(id: &str) -> Result<Arc<RepairTaskControl>, AppError> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err(AppError::new("download_task_invalid"));
    }
    let tasks = TASKS.get_or_init(Default::default);
    let mut tasks = tasks
        .lock()
        .map_err(|_| AppError::new("download_manager_unavailable"))?;
    if tasks.contains_key(id) {
        return Err(AppError::new("download_task_conflict"));
    }
    let control = Arc::new(RepairTaskControl {
        cancelled: AtomicBool::new(false),
        phase: AtomicU8::new(0),
    });
    tasks.insert(id.to_string(), Arc::clone(&control));
    Ok(control)
}

pub(crate) fn cancel_task(id: &str) -> Result<(), AppError> {
    let tasks = TASKS.get_or_init(Default::default);
    let tasks = tasks
        .lock()
        .map_err(|_| AppError::new("download_manager_unavailable"))?;
    let task = tasks
        .get(id)
        .ok_or_else(|| AppError::new("download_task_not_found"))?;
    task.phase
        .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| AppError::new("download_task_not_cancellable"))?;
    task.cancelled.store(true, Ordering::SeqCst);
    Ok(())
}

pub(crate) fn finish_task(id: &str) {
    if let Some(tasks) = TASKS.get() {
        if let Ok(mut tasks) = tasks.lock() {
            tasks.remove(id);
        }
    }
}
