mod archive;
mod download;
mod paths;

use serde::Serialize;
use std::path::Path;

const MAX_ARCHIVE_BYTES: u64 = 250 * 1024 * 1024;
const MAX_SKIN_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub folder_name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
}

pub fn download_and_install(
    url: &str,
    archive_name: &str,
    game_path: &str,
) -> Result<InstallResult, String> {
    let userskins = Path::new(game_path).join("UserSkins");
    std::fs::create_dir_all(&userskins)
        .map_err(|error| format!("No se pudo crear la carpeta UserSkins: {error}"))?;
    let staging = tempfile::Builder::new()
        .prefix("wtcm-")
        .tempdir_in(&userskins)
        .map_err(|error| format!("No se pudo preparar la instalación: {error}"))?;
    let archive_path = staging.path().join("download.archive");
    download::download_archive(url, &archive_path, MAX_ARCHIVE_BYTES)?;
    let payload = staging.path().join("payload");
    std::fs::create_dir(&payload).map_err(|error| error.to_string())?;
    archive::extract(&archive_path, archive_name, &payload, MAX_SKIN_BYTES)?;
    let (source, folder_name) = paths::select_skin_root(&payload, archive_name)?;
    let file_count = paths::count_files(&source)?;
    if file_count == 0 || !paths::contains_skin_definition(&source)? {
        return Err(
            "El archivo descargado no parece contener una skin válida de War Thunder.".into(),
        );
    }
    let size_bytes = paths::total_size(&source)?;
    let folder_name = paths::unique_folder_name(&userskins, &folder_name)?;
    let destination = userskins.join(&folder_name);
    std::fs::rename(&source, &destination)
        .map_err(|error| format!("No se pudo guardar la skin en UserSkins: {error}"))?;
    Ok(InstallResult {
        folder_name,
        path: destination.to_string_lossy().to_string(),
        file_count,
        size_bytes,
    })
}
