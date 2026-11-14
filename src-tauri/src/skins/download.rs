use reqwest::redirect::{Attempt, Policy};
use reqwest::header::{HeaderMap, CONTENT_LENGTH};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;

use super::download_task::{DownloadControl, SkinInstallProgress};
use crate::{http::USER_AGENT, AppError};

pub(crate) const MAX_SKIN_DOWNLOAD_BYTES: u64 = 250 * 1024 * 1024;
pub(crate) const DEFAULT_DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(180);
const POLL_INTERVAL: Duration = Duration::from_millis(120);

fn content_length(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(CONTENT_LENGTH)?
        .to_str()
        .ok()?
        .parse::<u64>()
        .ok()
}

fn trusted_wt_host(host: &str) -> bool {
    host == "warthunder.com" || host.ends_with(".warthunder.com")
}

fn trusted_download(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(trusted_wt_host)
}

pub(crate) async fn remote_file_size(url: &str) -> Result<Option<u64>, AppError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| AppError::new("download_invalid_url"))?;
    if !trusted_download(&parsed) {
        return Err(AppError::new("download_untrusted_host"));
    }

    let response = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(12))
        .user_agent(USER_AGENT)
        .redirect(Policy::custom(|attempt: Attempt<'_>| {
            if trusted_download(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| AppError::with_detail("download_client_error", error.to_string()))?
        .head(parsed)
        .send()
        .await
        .map_err(|error| {
            AppError::with_detail(
                "download_size_probe_failed",
                error.without_url().to_string(),
            )
        })?;

    if !trusted_download(response.url()) {
        return Err(AppError::new("download_redirect_untrusted"));
    }
    if !response.status().is_success() {
        return Ok(None);
    }

    Ok(content_length(response.headers()))
}

fn report_progress(
    channel: &Channel<SkinInstallProgress>,
    downloaded: u64,
    total: Option<u64>,
    paused: bool,
) -> Result<(), AppError> {
    channel
        .send(SkinInstallProgress {
            phase: "downloading",
            downloaded_bytes: downloaded,
            total_bytes: total,
            paused,
        })
        .map_err(|error| AppError::with_detail("download_progress_failed", error.to_string()))
}

pub(crate) async fn download_archive(
    url: &str,
    path: &Path,
    control: &DownloadControl,
    channel: &Channel<SkinInstallProgress>,
    max_archive_bytes: u64,
    max_download_duration: Duration,
    permission_error_code: &str,
) -> Result<(), AppError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| AppError::new("download_invalid_url"))?;
    if !trusted_download(&parsed) {
        return Err(AppError::new("download_untrusted_host"));
    }
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .user_agent(USER_AGENT)
        .redirect(Policy::custom(|attempt: Attempt<'_>| {
            if trusted_download(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| AppError::with_detail("download_client_error", error.to_string()))?;
    let mut response = tokio::time::timeout(DEFAULT_DOWNLOAD_TIMEOUT, client.get(parsed).send())
        .await
        .map_err(|_| AppError::new("download_timeout"))?
        .map_err(|error| {
            AppError::with_detail(
                "download_connection_failed",
                error.without_url().to_string(),
            )
        })?;
    control.check_cancelled()?;
    if !response.status().is_success() {
        return Err(AppError::new("download_http_error")
            .with_param("status", response.status().as_u16())
            .set_detail(format!("HTTP {}", response.status())));
    }
    if !trusted_download(response.url()) {
        return Err(AppError::new("download_redirect_untrusted"));
    }
    let total = response.content_length();
    if total.is_some_and(|size| size > max_archive_bytes) {
        return Err(
            AppError::new("download_size_exceeded").with_param("max_bytes", max_archive_bytes)
        );
    }

    let mut output = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::with_detail(permission_error_code, error.to_string())
            } else {
                AppError::with_detail("io_error", error.to_string())
            }
        })?;
    let mut downloaded = 0_u64;
    let mut active_started = Instant::now();
    let mut active_elapsed = Duration::ZERO;
    report_progress(channel, downloaded, total, false)?;
    loop {
        control.check_cancelled()?;
        if control.is_paused() {
            active_elapsed += active_started.elapsed();
            while control.is_paused() {
                control.check_cancelled()?;
                tokio::time::sleep(POLL_INTERVAL).await;
            }
            active_started = Instant::now();
        }
        if active_elapsed + active_started.elapsed() >= max_download_duration {
            return Err(AppError::new("download_timeout"));
        }
        let chunk = tokio::select! {
            result = response.chunk() => result.map_err(|error| AppError::with_detail("download_stream_failed", error.without_url().to_string()))?,
            _ = tokio::time::sleep(POLL_INTERVAL) => continue,
        };
        let Some(chunk) = chunk else { break };
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > max_archive_bytes || total.is_some_and(|size| downloaded > size) {
            return Err(
                AppError::new("download_size_exceeded").with_param("max_bytes", max_archive_bytes)
            );
        }
        output
            .write_all(&chunk)
            .await
            .map_err(|error| AppError::with_detail("io_error", error.to_string()))?;
        report_progress(channel, downloaded, total, false)?;
    }
    if downloaded == 0 {
        return Err(AppError::new("download_empty_file"));
    }
    if total.is_some_and(|size| downloaded != size) {
        return Err(AppError::new("download_incomplete"));
    }
    output
        .sync_all()
        .await
        .map_err(|error| AppError::with_detail("io_error", error.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::content_length;
    use reqwest::header::{HeaderMap, HeaderValue, CONTENT_LENGTH};

    #[test]
    fn parses_head_content_length_without_using_empty_body_size() {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("7654321"));
        assert_eq!(content_length(&headers), Some(7_654_321));
    }

    #[test]
    fn ignores_missing_or_invalid_content_length() {
        assert_eq!(content_length(&HeaderMap::new()), None);

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("unknown"));
        assert_eq!(content_length(&headers), None);
    }
}
