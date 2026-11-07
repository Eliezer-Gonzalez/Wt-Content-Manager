mod commands;
pub mod error;
mod game_install;
pub mod http;
mod providers;
mod skins;

pub use error::AppError;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(skins::download_task::DownloadManager::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_recent_camouflages,
            commands::fetch_post_detail,
            commands::detect_game_installations,
            commands::validate_game_installation,
            commands::install_skin,
            commands::set_skin_download_paused,
            commands::cancel_skin_download,
            commands::scan_installed_skins,
            commands::uninstall_skin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WT Content Manager");
}
