use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::{logging, AppError};

fn validate_external_url(value: &str) -> Result<String, AppError> {
    let url = reqwest::Url::parse(value).map_err(|_| AppError::new("external_link_invalid"))?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(AppError::new("external_link_invalid"));
    }
    Ok(url.to_string())
}

#[tauri::command]
pub fn open_external_https_url(
    app: AppHandle,
    url: String,
    logger: State<'_, logging::DiagnosticLogger>,
) -> Result<(), AppError> {
    let url = validate_external_url(&url)?;
    let result = app
        .opener()
        .open_url(url, None::<&str>)
        .map_err(|_| AppError::new("external_link_open_failed"));
    crate::commands::record_failure(&logger, "open_external_https_url", result)
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn only_credential_free_https_urls_are_opened() {
        assert!(validate_external_url("https://opex-sound-mod.com/changelog.html").is_ok());
        assert!(validate_external_url("http://opex-sound-mod.com/changelog.html").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("https://user@example.com/path").is_err());
    }
}
