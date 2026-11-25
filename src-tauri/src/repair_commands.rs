use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc};
use tauri::{ipc::Channel, AppHandle, Manager};

use crate::{
    skins::repair::{self, RepairCandidate, RepairProgress},
    AppError,
};

fn library_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("local-library.json"))
        .map_err(|error| AppError::with_detail("local_library_path_failed", error.to_string()))
}

#[tauri::command]
pub async fn repair_skin_links(
    app: AppHandle,
    game_path: String,
    task_id: String,
    on_progress: Channel<RepairProgress>,
) -> Result<repair::RepairResult, AppError> {
    let control: Arc<repair::RepairTaskControl> = repair::register_task(&task_id)?;
    let path = match library_path(&app) {
        Ok(path) => path,
        Err(error) => {
            repair::finish_task(&task_id);
            return Err(error);
        }
    };
    let task_id_for_worker = task_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let base = crate::local_library::load(&path)?.unwrap_or_else(|| json!({"favorites":[],"installedSkins":[],"externalSkinPublications":[],"repairRevision":0}));
        let progress_channel = on_progress.clone();
        let proposed = repair::analyze(&game_path, base.clone(), control.cancellation_flag(), |progress| { let _ = progress_channel.send(progress); })?;
        if control.is_cancelled() { return Err(AppError::new("download_cancelled")); }
        control.begin_finalizing()?;
        let _ = on_progress.send(RepairProgress { phase: "finalizing", completed: 1, total: 1, current: String::new() });
        let mut saved = crate::skins::repair::persist_repair_result(&path, &game_path, &base, &proposed.library)?;
        // Preserve automatic links and report their candidates from the same operation.
        let mut result = proposed;
        result.auto_linked = result.library.get("installedSkins").and_then(serde_json::Value::as_array).map(|proposed_skins| {
            let base_skins = base.get("installedSkins").and_then(serde_json::Value::as_array).cloned().unwrap_or_default();
            proposed_skins.iter().filter(|proposed_record| {
                let Some(id) = proposed_record.get("recordId").and_then(serde_json::Value::as_str) else { return false; };
                let Some(before) = base_skins.iter().find(|record| record.get("recordId").and_then(serde_json::Value::as_str) == Some(id)) else { return false; };
                let Some(after_path) = proposed_record.get("path").and_then(serde_json::Value::as_str) else { return false; };
                before.get("path").and_then(serde_json::Value::as_str) != Some(after_path)
                    && saved.get("installedSkins").and_then(serde_json::Value::as_array).is_some_and(|saved_skins| saved_skins.iter().any(|record| record.get("recordId").and_then(serde_json::Value::as_str) == Some(id) && record.get("path").and_then(serde_json::Value::as_str) == Some(after_path)))
            }).count()
        }).unwrap_or(0);
        result.library = std::mem::take(&mut saved);
        Ok(result)
    }).await.map_err(|error| AppError::with_detail("skin_repair_failed", error.to_string()));
    repair::finish_task(&task_id_for_worker);
    result?
}

#[tauri::command]
pub fn cancel_skin_link_repair(task_id: String) -> Result<(), AppError> {
    repair::cancel_task(&task_id)
}

#[tauri::command]
pub async fn confirm_skin_link_candidate(
    app: AppHandle,
    game_path: String,
    candidate: RepairCandidate,
) -> Result<Value, AppError> {
    let path = library_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        crate::skins::repair::confirm_repair_candidate(&path, &game_path, &candidate)
    })
    .await
    .map_err(|error| AppError::with_detail("skin_repair_failed", error.to_string()))?
}

#[tauri::command]
pub async fn commit_imported_skin_links(
    app: AppHandle,
    game_path: String,
    base: Value,
    proposed: Value,
    imported_skins: Vec<Value>,
    task_id: String,
    on_progress: Channel<RepairProgress>,
) -> Result<Value, AppError> {
    let control = repair::register_task(&task_id)?;
    let path = match library_path(&app) {
        Ok(path) => path,
        Err(error) => { repair::finish_task(&task_id); return Err(error); }
    };
    let task_id_for_worker = task_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let progress_channel = on_progress.clone();
        crate::skins::repair::persist_import_result(&path, &game_path, &base, &proposed, &imported_skins, &control, |progress| { let _ = progress_channel.send(progress); })
    })
    .await
    .map_err(|error| AppError::with_detail("skin_repair_failed", error.to_string()));
    repair::finish_task(&task_id_for_worker);
    result?
}
