use serde_json::Value;

const BASE_URL: &str = "https://live.warthunder.com";

async fn post_form(path: &str, fields: &[(&str, &str)]) -> Result<Value, String> {
    reqwest::Client::new()
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

pub async fn recent_camouflages() -> Result<Value, String> {
    let response = post_form("/api/feed/get_regular/", &[
        ("content", "camouflage"), ("sort", "date"), ("user", ""),
        ("period", ""), ("searchString", ""), ("page", "0"),
        ("featured", "false"), ("subtype", "all"),
    ]).await?;
    if response["status"] != "OK" || !response["data"]["list"].is_array() {
        return Err("WT Live devolvió un feed con formato inesperado.".into());
    }
    Ok(response)
}

pub async fn post_detail(lang_group: u64) -> Result<Value, String> {
    let response = post_form("/api/posts/get/", &[
        ("lang_group", &lang_group.to_string()), ("language", "0"),
    ]).await?;
    if response["description"].as_str().is_none() {
        return Err("WT Live no devolvió el detalle de esta publicación.".into());
    }
    Ok(response)
}
