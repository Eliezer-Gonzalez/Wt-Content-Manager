mod commands;
pub mod error;
mod external_links;
mod game_install;
pub mod http;
mod logging;
mod providers;
mod settings;
mod skins;
mod sounds;

use tauri::Manager;

pub use error::AppError;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(skins::download_task::DownloadManager::default())
        .manage(logging::DiagnosticLogger::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let logger = app.state::<logging::DiagnosticLogger>().inner().clone();
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                if let Err(error) = logger.initialize(&app_data_dir.join("logs")) {
                    eprintln!("Could not initialize local diagnostics: {error}");
                }
            }

            let panic_logger = logger.clone();
            let previous_hook = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |panic_info| {
                let _ = panic_logger.write("error", "rust_panic", &panic_info.to_string());
                previous_hook(panic_info);
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch_recent_camouflages,
            commands::fetch_recent_sounds,
            commands::fetch_post_detail,
            external_links::open_external_https_url,
            commands::detect_game_installations,
            commands::validate_game_installation,
            commands::install_skin,
            commands::set_skin_download_paused,
            commands::cancel_skin_download,
            commands::scan_installed_skins,
            commands::uninstall_skin,
            commands::get_diagnostic_settings,
            commands::set_diagnostic_logging_enabled,
            commands::write_diagnostic,
            commands::read_recent_diagnostics,
            commands::open_diagnostics_folder,
            sounds::commands::list_sound_packages,
            sounds::commands::download_sound_package,
            sounds::commands::set_sound_download_paused,
            sounds::commands::cancel_sound_download,
            sounds::commands::get_sound_mod_status,
            sounds::commands::get_sound_install_preflight,
            sounds::commands::install_sound_package,
            sounds::commands::restore_sound_mod_backup,
            sounds::commands::open_sound_mod_folder,
            sounds::commands::open_sound_package_library_folder,
            settings::get_orphan_temporary_files,
            settings::cleanup_orphan_temporary_files,
            settings::open_user_skins_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WT Content Manager");
}
