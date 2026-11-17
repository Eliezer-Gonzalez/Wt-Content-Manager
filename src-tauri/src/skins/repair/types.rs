use super::super::fingerprint::SkinFingerprint;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

#[derive(Clone)]
pub(super) struct Folder {
    pub(super) name: String,
    pub(super) path: PathBuf,
    pub(super) fingerprint: SkinFingerprint,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepairCandidate {
    #[serde(default)]
    pub(crate) record_id: String,
    pub(crate) record_path: String,
    pub(crate) folder_name: String,
    pub(crate) folder_path: String,
    pub(crate) matching_files: usize,
    pub(crate) total_files: usize,
    pub(crate) matching_bytes: u64,
    pub(crate) total_bytes: u64,
    pub(crate) match_percent: u8,
    pub(crate) reason: String,
    #[serde(default)]
    pub(crate) source_fingerprint: Option<SkinFingerprint>,
    #[serde(default)]
    pub(crate) item: Option<Value>,
    #[serde(default)]
    pub(crate) external_publication: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepairProgress {
    pub(crate) phase: &'static str,
    pub(crate) completed: usize,
    pub(crate) total: usize,
    pub(crate) current: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepairResult {
    pub(crate) library: Value,
    pub(crate) candidates: Vec<RepairCandidate>,
    pub(crate) auto_linked: usize,
    pub(crate) baseline_count: usize,
}
