use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundPackage {
    pub id: String,
    pub lang_group: u64,
    pub title: String,
    pub author: String,
    pub archive_name: String,
    pub size_bytes: u64,
    pub downloaded_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundModStatus {
    pub game_running: bool,
    pub process_status: String,
    pub installed_banks: usize,
    pub backup_available: bool,
    pub active_package_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundInstallResult {
    pub package_id: String,
    pub installed_banks: usize,
    pub backup_created: bool,
}
