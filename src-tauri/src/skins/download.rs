use reqwest::redirect::{Attempt, Policy};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;

use super::download_task::{DownloadControl, SkinInstallProgress};

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
) -> Result<(), String> {
    channel
        .send(SkinInstallProgress {
            phase: "downloading",
            downloaded_bytes: downloaded,
            total_bytes: total,
            paused,
        })
        .map_err(|error| format!("No se pudo actualizar el progreso de descarga: {error}"))
}

pub async fn download_archive(
    url: &str,
    path: &Path,
    control: &DownloadControl,
    channel: &Channel<SkinInstallProgress>,
) -> Result<(), String> {
    let parsed =
        reqwest::Url::parse(url).map_err(|_| "WT Live devolvió una URL inválida.".to_string())?;
    if !trusted_download(&parsed) {
        return Err("La descarga de skins solo admite enlaces HTTPS de WT Live.".into());
    }
    let user_agent = format!("WT-Content-Manager/{}", env!("CARGO_PKG_VERSION"));
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .user_agent(user_agent)
        .redirect(Policy::custom(|attempt: Attempt<'_>| {
            if trusted_download(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| format!("No se pudo preparar la conexión de descarga: {error}"))?;
    let mut response = tokio::time::timeout(READ_TIMEOUT, client.get(parsed).send())
        .await
        .map_err(|_| "WT Live tardó demasiado en iniciar la descarga.".to_string())?
        .map_err(|error| format!("No se pudo descargar la skin desde WT Live: {error}"))?;
    control.check_cancelled()?;
    if !response.status().is_success() {
        return Err(format!(
            "WT Live respondió con HTTP {} al descargar la skin.",
            response.status()
        ));
    }
    if !trusted_download(response.url()) {
        return Err("WT Live redirigió la descarga a un dominio que no es de confianza.".into());
    }
    let total = response.content_length();
    if total.is_some_and(|size| size > MAX_ARCHIVE_BYTES) {
        return Err("La descarga supera el límite de tamaño permitido para una skin.".into());
    }

    let mut output = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await
        .map_err(|error| format!("No se pudo crear el archivo temporal: {error}"))?;
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
            return Err("La descarga tardó demasiado en completarse.".into());
        }
        let chunk = tokio::select! {
            result = response.chunk() => result.map_err(|error| format!("Falló la descarga de la skin: {error}"))?,
            _ = tokio::time::sleep(POLL_INTERVAL) => continue,
        };
        let Some(chunk) = chunk else { break };
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > MAX_ARCHIVE_BYTES || total.is_some_and(|size| downloaded > size) {
            return Err("La descarga supera el tamaño permitido o declarado.".into());
        }
        output
            .write_all(&chunk)
            .await
            .map_err(|error| format!("No se pudo guardar la descarga temporal: {error}"))?;
        report_progress(channel, downloaded, total, false)?;
    }
    if downloaded == 0 {
        return Err("WT Live devolvió un archivo vacío.".into());
    }
    if total.is_some_and(|size| downloaded != size) {
        return Err("La descarga quedó incompleta; inténtalo nuevamente.".into());
    }
    output.sync_all().await.map_err(|error| error.to_string())?;
    Ok(())
}
