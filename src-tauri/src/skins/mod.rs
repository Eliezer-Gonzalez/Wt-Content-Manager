mod archive;
mod download;
pub mod download_task;
mod paths;

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tempfile::TempDir;

use download_task::{DownloadControl, SkinInstallProgress};

const MAX_SKIN_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub folder_name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
}

pub struct InstallStaging {
    userskins: PathBuf,
    archive_path: PathBuf,
    staging_dir: TempDir,
}

impl InstallStaging {
    pub fn new(game_path: &str) -> Result<Self, String> {
        let userskins = Path::new(game_path).join("UserSkins");
        std::fs::create_dir_all(&userskins)
            .map_err(|error| format!("No se pudo crear la carpeta UserSkins: {error}"))?;
        let staging = tempfile::Builder::new()
            .prefix("wtcm-")
            .tempdir_in(&userskins)
            .map_err(|error| format!("No se pudo preparar la instalación: {error}"))?;
        let archive_path = staging.path().join("download.archive");
        Ok(Self {
            userskins,
            archive_path,
            staging_dir: staging,
        })
    }

    pub async fn download(
        &self,
        url: &str,
        control: &DownloadControl,
        channel: &Channel<SkinInstallProgress>,
    ) -> Result<(), String> {
        download::download_archive(url, &self.archive_path, control, channel).await
    }

    pub fn extract_and_install(self, archive_name: &str) -> Result<InstallResult, String> {
        let payload = self.staging_dir.path().join("payload");
        std::fs::create_dir(&payload).map_err(|error| error.to_string())?;
        archive::extract(&self.archive_path, archive_name, &payload, MAX_SKIN_BYTES)?;
        let (source, folder_name) = paths::select_skin_root(&payload, archive_name)?;
        let file_count = paths::count_files(&source)?;
        if file_count == 0 || !paths::contains_skin_definition(&source)? {
            return Err(
                "El archivo descargado no parece contener una skin válida de War Thunder.".into(),
            );
        }
        let size_bytes = paths::total_size(&source)?;
        let folder_name = paths::unique_folder_name(&self.userskins, &folder_name)?;
        let destination = self.userskins.join(&folder_name);
        std::fs::rename(&source, &destination)
            .map_err(|error| format!("No se pudo guardar la skin en UserSkins: {error}"))?;
        Ok(InstallResult {
            folder_name,
            path: destination.to_string_lossy().to_string(),
            file_count,
            size_bytes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::InstallStaging;

    #[test]
    fn dropping_staging_removes_partial_download_and_keeps_user_skins() {
        let game_root = tempfile::tempdir().unwrap();
        let staging = InstallStaging::new(game_root.path().to_str().unwrap()).unwrap();
        let staging_path = staging.archive_path.parent().unwrap().to_path_buf();
        std::fs::write(&staging.archive_path, b"partial archive").unwrap();
        assert!(staging.archive_path.exists());

        drop(staging);

        assert!(!staging_path.exists());
        assert!(game_root.path().join("UserSkins").is_dir());
    }
}
