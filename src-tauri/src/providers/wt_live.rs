use reqwest::redirect::{Attempt, Policy};
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

use crate::{http::USER_AGENT, AppError};

const BASE_URL: &str = "https://live.warthunder.com";
const MAX_API_RESPONSE_BYTES: usize = 8 * 1024 * 1024;

static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

fn is_allowed_api_redirect(url: &reqwest::Url) -> bool {
    url.scheme() == "https" && url.host_str() == Some("live.warthunder.com")
}

fn append_limited_response_chunk(
    body: &mut Vec<u8>,
    chunk: &[u8],
    max_bytes: usize,
) -> Result<(), AppError> {
    if body.len().saturating_add(chunk.len()) > max_bytes {
        return Err(AppError::new("wt_live_response_too_large"));
    }
    body.extend_from_slice(chunk);
    Ok(())
}

fn client() -> Result<&'static reqwest::Client, AppError> {
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent(USER_AGENT)
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(25))
                .https_only(true)
                .redirect(Policy::custom(|attempt: Attempt<'_>| {
                    if is_allowed_api_redirect(attempt.url()) {
                        attempt.follow()
                    } else {
                        attempt.stop()
                    }
                }))
                .build()
                .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(|detail| AppError::with_detail("wt_live_client_error", detail.clone()))
}

async fn post_form(path: &str, fields: &[(&str, &str)]) -> Result<Value, AppError> {
    let response = client()?
        .post(format!("{BASE_URL}{path}"))
        .form(fields)
        .send()
        .await
        .map_err(|error| AppError::with_detail("wt_live_unreachable", error.without_url().to_string()))?;

    if let Err(error) = response.error_for_status_ref() {
        let status = error.status().map(|s| s.as_u16()).unwrap_or(500);
        return Err(AppError::new("wt_live_http_error")
            .with_param("status", status)
            .set_detail(format!("HTTP status {status}")));
    }

    if response
        .content_length()
        .is_some_and(|length| length > MAX_API_RESPONSE_BYTES as u64)
    {
        return Err(AppError::new("wt_live_response_too_large"));
    }
    let mut response = response;
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| AppError::with_detail("wt_live_invalid_response", error.without_url().to_string()))?
    {
        append_limited_response_chunk(&mut body, &chunk, MAX_API_RESPONSE_BYTES)?;
    }
    serde_json::from_slice(&body)
        .map_err(|error| AppError::with_detail("wt_live_invalid_response", error.to_string()))
}

pub async fn recent_camouflages(
    search_string: &str,
    period: u32,
    page: u32,
    sort: &str,
) -> Result<Value, AppError> {
    let search_string: String = search_string.trim().chars().take(120).collect();
    let period = if [0, 7, 90, 180].contains(&period) {
        period
    } else {
        0
    };
    let page = page.min(1_000);
    let sort = if sort == "rating" {
        "rating"
    } else {
        "created"
    };
    let response = post_form(
        "/api/feed/get_regular/",
        &[
            ("content", "camouflage"),
            ("sort", sort),
            ("user", ""),
            ("period", &period.to_string()),
            ("searchString", &search_string),
            ("page", &page.to_string()),
            ("featured", "false"),
            ("subtype", "all"),
        ],
    )
    .await?;
    if response["status"] != "OK" || !response["data"]["list"].is_array() {
        return Err(AppError::new("wt_live_invalid_feed"));
    }
    Ok(response)
}

pub async fn post_detail(lang_group: u64) -> Result<Value, AppError> {
    let response = post_form(
        "/api/posts/get/",
        &[("lang_group", &lang_group.to_string()), ("language", "0")],
    )
    .await?;
    if response["description"].as_str().is_none() {
        return Err(AppError::new("wt_live_post_not_found"));
    }
    Ok(response)
}

pub async fn skin_download_source(lang_group: u64) -> Result<(String, String), AppError> {
    let post = post_detail(lang_group).await?;
    let file = &post["file"];
    let url = file["link"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new("wt_live_no_download"))?;
    let name = file["name"]
        .as_str()
        .filter(|value| !value.is_empty())
        .unwrap_or("skin.zip");
    Ok((url.to_string(), name.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_redirects_must_remain_on_the_https_wt_live_host() {
        assert!(is_allowed_api_redirect(
            &reqwest::Url::parse("https://live.warthunder.com/x").unwrap()
        ));
        assert!(!is_allowed_api_redirect(
            &reqwest::Url::parse("http://live.warthunder.com/x").unwrap()
        ));
        assert!(!is_allowed_api_redirect(
            &reqwest::Url::parse("https://evil.example/x").unwrap()
        ));
        assert!(!is_allowed_api_redirect(
            &reqwest::Url::parse("https://images-live.warthunder.com/x").unwrap()
        ));
    }

    #[test]
    fn response_chunks_cannot_exceed_the_configured_limit() {
        let mut body = Vec::new();
        assert!(append_limited_response_chunk(&mut body, b"1234", 3).is_err());
        assert!(body.is_empty());
    }
}
