mod analysis;
mod matching;
mod task;
mod types;
use serde_json::Value;
pub(crate) use analysis::analyze;
pub(crate) use matching::confirm_candidate;
pub(crate) use task::{cancel_task, finish_task, register_task, RepairTaskControl};
pub(crate) use types::{RepairCandidate, RepairProgress, RepairResult};

pub(crate) fn ensure_record_id(record: &mut Value, index: usize) {
    if record.get("recordId").and_then(Value::as_str).is_some_and(|id| !id.is_empty()) { return; }
    let path = record.get("path").and_then(Value::as_str).unwrap_or_default();
    let normalized = matching::normalize_path(path);
    let mut hash = 2_166_136_261_u32;
    for byte in normalized.bytes() { hash = (hash ^ u32::from(byte)).wrapping_mul(16_777_619); }
    record["recordId"] = serde_json::json!(format!("skin-{index}-{hash:08x}"));
}

#[cfg(test)]
#[path = "repair/tests.rs"]
mod tests;
