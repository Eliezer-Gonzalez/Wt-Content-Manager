use reqwest::blocking::{Client, Response};
use reqwest::redirect::{Attempt, Policy};
use std::fs::OpenOptions;
use std::io::{self, Read};
use std::path::Path;
use std::time::Duration;

fn trusted_wt_host(host: &str) -> bool {
    host == "warthunder.com" || host.ends_with(".warthunder.com")
}

fn trusted_download(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(trusted_wt_host)
}

fn checked_response(response: Response, path: &Path, limit: u64) -> Result<u64, String> {
    if !response.status().is_success() {
        return Err(format!(
            "WT Live respondió con HTTP {} al descargar la skin.",
            response.status()
        ));
    }
    if !trusted_download(response.url()) {
        return Err("WT Live redirigió la descarga a un dominio que no es de confianza.".into());
    }
    if response.content_length().is_some_and(|size| size > limit) {
        return Err("La descarga supera el límite de tamaño permitido para una skin.".into());
    }

    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("No se pudo crear el archivo temporal: {error}"))?;
    let mut limited = response.take(limit.saturating_add(1));
    let written = io::copy(&mut limited, &mut output)
        .map_err(|error| format!("Falló la descarga de la skin: {error}"))?;
    if written == 0 {
        return Err("WT Live devolvió un archivo vacío.".into());
    }
    if written > limit {
        return Err("La descarga supera el límite de tamaño permitido para una skin.".into());
    }
    output.sync_all().map_err(|error| error.to_string())?;
    Ok(written)
}

pub fn download_archive(url: &str, path: &Path, limit: u64) -> Result<u64, String> {
    let parsed =
        reqwest::Url::parse(url).map_err(|_| "WT Live devolvió una URL inválida.".to_string())?;
    if !trusted_download(&parsed) {
        return Err("La descarga de skins solo admite enlaces HTTPS de WT Live.".into());
    }
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .user_agent("WT Content Manager")
        .redirect(Policy::custom(|attempt: Attempt<'_>| {
            if trusted_download(attempt.url()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| format!("No se pudo preparar la conexión de descarga: {error}"))?;
    let response = client
        .get(parsed)
        .send()
        .map_err(|error| format!("No se pudo descargar la skin desde WT Live: {error}"))?;
    checked_response(response, path, limit)
}
