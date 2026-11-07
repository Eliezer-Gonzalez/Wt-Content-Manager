mod commands;
mod game_install;
mod providers;
mod skins;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_recent_camouflages,
            commands::fetch_post_detail,
            commands::detect_game_installations,
            commands::validate_game_installation,
            commands::install_skin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WT Content Manager");
}
