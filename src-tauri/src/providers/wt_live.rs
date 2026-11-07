use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

const BASE_URL: &str = "https://live.warthunder.com";

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        let user_agent = format!("WT-Content-Manager/{}", env!("CARGO_PKG_VERSION"));
        reqwest::Client::builder()
            .user_agent(user_agent)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(25))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

async fn post_form(path: &str, fields: &[(&str, &str)]) -> Result<Value, String> {
    client()
        .post(format!("{BASE_URL}{path}"))
        .form(fields)
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con WT Live: {error}"))?
        .error_for_status()
        .map_err(|error| format!("WT Live respondió con un error: {error}"))?
        .json::<Value>()
        .await
        .map_err(|error| format!("WT Live devolvió una respuesta inválida: {error}"))
}

pub async fn recent_camouflages(
    search_string: &str,
    period: u32,
    page: u32,
    sort: &str,
) -> Result<Value, String> {
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
        return Err("WT Live devolvió un feed con formato inesperado.".into());
    }
    Ok(response)
}

pub async fn post_detail(lang_group: u64) -> Result<Value, String> {
    let response = post_form(
        "/api/posts/get/",
        &[("lang_group", &lang_group.to_string()), ("language", "0")],
    )
    .await?;
    if response["description"].as_str().is_none() {
        return Err("WT Live no devolvió el detalle de esta publicación.".into());
    }
    Ok(response)
}

pub async fn skin_download_source(lang_group: u64) -> Result<(String, String), String> {
    let post = post_detail(lang_group).await?;
    let file = &post["file"];
    let url = file["link"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "WT Live no publicó un archivo descargable para esta skin.".to_string())?;
    let name = file["name"]
        .as_str()
        .filter(|value| !value.is_empty())
        .unwrap_or("skin.zip");
    Ok((url.to_string(), name.to_string()))
}
