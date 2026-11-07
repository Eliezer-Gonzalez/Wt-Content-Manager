use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fmt;

fn skip_if_empty_params(params: &Option<BTreeMap<String, Value>>) -> bool {
    params.as_ref().is_none_or(|m| m.is_empty())
}

fn skip_if_empty_detail(detail: &Option<String>) -> bool {
    detail.as_ref().is_none_or(|s| s.is_empty())
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AppError {
    pub code: String,
    #[serde(skip_serializing_if = "skip_if_empty_params")]
    pub params: Option<BTreeMap<String, Value>>,
    #[serde(skip_serializing_if = "skip_if_empty_detail")]
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(code: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            params: None,
            detail: None,
        }
    }

    pub fn with_detail(code: impl Into<String>, detail: impl Into<String>) -> Self {
        let d = detail.into();
        Self {
            code: code.into(),
            params: None,
            detail: if d.is_empty() { None } else { Some(d) },
        }
    }

    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<Value>) -> Self {
        let mut map = self.params.unwrap_or_default();
        map.insert(key.into(), value.into());
        self.params = Some(map);
        self
    }

    pub fn set_detail(mut self, detail: impl Into<String>) -> Self {
        let d = detail.into();
        self.detail = if d.is_empty() { None } else { Some(d) };
        self
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(detail) = &self.detail {
            write!(f, "{}: {}", self.code, detail)
        } else {
            write!(f, "{}", self.code)
        }
    }
}

impl std::error::Error for AppError {}

impl From<&str> for AppError {
    fn from(code: &str) -> Self {
        Self::new(code)
    }
}

impl From<String> for AppError {
    fn from(code: String) -> Self {
        Self::new(code)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        if error.kind() == std::io::ErrorKind::PermissionDenied {
            Self::with_detail("game_permission_denied", error.to_string())
        } else {
            Self::with_detail("io_error", error.to_string())
        }
    }
}

impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            Self::with_detail("download_timeout", error.to_string())
        } else if error.is_connect() {
            Self::with_detail("wt_live_unreachable", error.to_string())
        } else if let Some(status) = error.status() {
            Self::new("wt_live_http_error")
                .with_param("status", status.as_u16())
                .set_detail(error.to_string())
        } else {
            Self::with_detail("wt_live_unreachable", error.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_code_only_omits_params_and_detail() {
        let err = AppError::new("archive_limits_exceeded");
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"code":"archive_limits_exceeded"}"#);
    }

    #[test]
    fn serializes_with_detail_omits_params() {
        let err = AppError::with_detail("io_error", "Access is denied (os error 5)");
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(
            json,
            r#"{"code":"io_error","detail":"Access is denied (os error 5)"}"#
        );
    }

    #[test]
    fn serializes_with_params_omits_detail() {
        let err = AppError::new("download_http_error").with_param("status", 404);
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(
            json,
            r#"{"code":"download_http_error","params":{"status":404}}"#
        );
    }

    #[test]
    fn serializes_with_params_and_detail() {
        let err = AppError::new("download_size_exceeded")
            .with_param("max_bytes", 250 * 1024 * 1024)
            .set_detail("Exceeded 262144000 bytes");
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(
            json,
            r#"{"code":"download_size_exceeded","params":{"max_bytes":262144000},"detail":"Exceeded 262144000 bytes"}"#
        );
    }

    #[test]
    fn io_permission_denied_maps_to_game_permission_denied() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "forbidden");
        let app_err = AppError::from(io_err);
        assert_eq!(app_err.code, "game_permission_denied");
        assert!(app_err.detail.unwrap().contains("forbidden"));
    }
}
