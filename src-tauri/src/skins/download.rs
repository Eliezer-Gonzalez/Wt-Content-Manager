use reqwest::redirect::{Attempt, Policy};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;

use super::download_task::{DownloadControl, SkinInstallProgress};
use crate::{http::USER_AGENT, AppError};

const MAX_ARCHIVE_BYTES: u64 = 250 * 1024 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(180);
const POLL_INTERVAL: Duration = Duration::from_millis(120);

fn trusted_wt_host(host: &str) -> bool {
    host == "warthunder.com" || host.ends_with(".warthunder.com")
}

fn trusted_download(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(trusted_wt_host)
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

pub async fn download_archive(
    url: &str,
    path: &Path,
    control: &DownloadControl,
    channel: &Channel<SkinInstallProgress>,
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
    let mut response = tokio::time::timeout(READ_TIMEOUT, client.get(parsed).send())
        .await
        .map_err(|_| AppError::new("download_timeout"))?
        .map_err(|error| AppError::with_detail("download_connection_failed", error.to_string()))?;
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
    if total.is_some_and(|size| size > MAX_ARCHIVE_BYTES) {
        return Err(
            AppError::new("download_size_exceeded").with_param("max_bytes", MAX_ARCHIVE_BYTES)
        );
    }

    let mut output = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::with_detail("game_permission_denied", error.to_string())
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
        if active_elapsed + active_started.elapsed() >= READ_TIMEOUT {
            return Err(AppError::new("download_timeout"));
        }
        let chunk = tokio::select! {
            result = response.chunk() => result.map_err(|error| AppError::with_detail("download_stream_failed", error.to_string()))?,
            _ = tokio::time::sleep(POLL_INTERVAL) => continue,
        };
        let Some(chunk) = chunk else { break };
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > MAX_ARCHIVE_BYTES || total.is_some_and(|size| downloaded > size) {
            return Err(
                AppError::new("download_size_exceeded").with_param("max_bytes", MAX_ARCHIVE_BYTES)
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
