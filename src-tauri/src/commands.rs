use serde_json::Value;
use tauri::{ipc::Channel, State};

use crate::{game_install, providers::wt_live, skins};

#[tauri::command]
pub async fn fetch_recent_camouflages(
    search_string: String,
    period: u32,
    page: u32,
    sort: String,
) -> Result<Value, String> {
    wt_live::recent_camouflages(&search_string, period, page, &sort).await
}

#[tauri::command]
pub async fn fetch_post_detail(lang_group: u64) -> Result<Value, String> {
    wt_live::post_detail(lang_group).await
}

#[tauri::command]
pub fn detect_game_installations() -> Vec<game_install::GameInstall> {
    game_install::detect()
}

#[tauri::command]
pub fn validate_game_installation(path: String) -> Result<game_install::GameInstall, String> {
    game_install::validate(&path)
}

#[tauri::command]
pub async fn install_skin(
    lang_group: u64,
    game_path: String,
    task_id: String,
    on_progress: Channel<skins::download_task::SkinInstallProgress>,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<skins::InstallResult, String> {
    use skins::download_task::SkinInstallProgress;

    let control = manager.register(&task_id)?;
    let result = async {
        on_progress
            .send(SkinInstallProgress {
                phase: "preparing",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            })
            .map_err(|error| format!("No se pudo iniciar la descarga: {error}"))?;
        game_install::validate(&game_path)?;
        let (download_url, archive_name) = wt_live::skin_download_source(lang_group).await?;
        control.check_cancelled()?;
        let staging = skins::InstallStaging::new(&game_path)?;
        control.begin_download();
        staging
            .download(&download_url, &control, &on_progress)
            .await?;
        control.check_cancelled()?;
        control.begin_extraction();
        on_progress
            .send(SkinInstallProgress {
                phase: "extracting",
                downloaded_bytes: 0,
                total_bytes: None,
                paused: false,
            })
            .map_err(|error| format!("No se pudo actualizar el estado de instalación: {error}"))?;
        tauri::async_runtime::spawn_blocking(move || staging.extract_and_install(&archive_name))
            .await
            .map_err(|error| format!("La instalación de la skin se interrumpió: {error}"))?
    }
    .await;
    manager.finish(&task_id);
    result
}

#[tauri::command]
pub fn set_skin_download_paused(
    task_id: String,
    paused: bool,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<(), String> {
    manager.set_paused(&task_id, paused)
}

#[tauri::command]
pub fn cancel_skin_download(
    task_id: String,
    manager: State<'_, skins::download_task::DownloadManager>,
) -> Result<(), String> {
    manager.cancel(&task_id)
}
