use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInstall {
    pub path: String,
    pub source: String,
}

fn valid_root(path: &Path) -> bool {
    path.join("win64").join("aces.exe").is_file()
        || path.join("aces.exe").is_file()
}

fn push_if_valid(found: &mut Vec<GameInstall>, path: PathBuf, source: &str) {
    if valid_root(&path) {
        let normalized = path.to_string_lossy().trim_end_matches(['\\', '/']).to_string();
        if !found.iter().any(|install| install.path.eq_ignore_ascii_case(&normalized)) {
            found.push(GameInstall { path: normalized, source: source.to_string() });
        }
    }
}

fn parse_library_paths(file: &Path) -> Vec<PathBuf> {
    let Ok(contents) = std::fs::read_to_string(file) else { return Vec::new() };
    contents.lines().filter_map(|line| {
        let (_, value) = line.split_once("\"path\"")?;
        let value = value.trim().trim_start_matches('{').trim();
        let value = value.trim_matches('"').replace("\\\\", "\\");
        Some(PathBuf::from(value))
    }).collect()
}

#[cfg(windows)]
fn steam_roots() -> Vec<PathBuf> {
    use winreg::{enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE}, RegKey};
    [
        (HKEY_CURRENT_USER, "Software\\Valve\\Steam"),
        (HKEY_LOCAL_MACHINE, "Software\\Valve\\Steam"),
        (HKEY_LOCAL_MACHINE, "Software\\WOW6432Node\\Valve\\Steam"),
    ].iter().filter_map(|(hive, subkey)| {
        let key = RegKey::predef(*hive).open_subkey(subkey).ok()?;
        let path: String = key.get_value("SteamPath").ok()?;
        Some(PathBuf::from(path.replace('/', "\\")))
    }).collect()
}

#[cfg(not(windows))]
fn steam_roots() -> Vec<PathBuf> { Vec::new() }

#[cfg(windows)]
fn gaijin_roots() -> Vec<PathBuf> {
    use winreg::{enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE}, RegKey};
    let locations = [
        (HKEY_CURRENT_USER, "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (HKEY_LOCAL_MACHINE, "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (HKEY_LOCAL_MACHINE, "Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
    ];
    let mut paths = Vec::new();
    for (hive, location) in locations {
        let Ok(uninstall) = RegKey::predef(hive).open_subkey(location) else { continue };
        for name in uninstall.enum_keys().flatten() {
            let Ok(game) = uninstall.open_subkey(name) else { continue };
            let display_name: String = game.get_value("DisplayName").unwrap_or_default();
            if !display_name.to_ascii_lowercase().contains("war thunder") { continue }
            if let Ok(path) = game.get_value::<String, _>("InstallLocation") {
                if !path.is_empty() { paths.push(PathBuf::from(path)); }
            }
            if let Ok(icon) = game.get_value::<String, _>("DisplayIcon") {
                let path = icon.trim_matches('"').split(',').next().unwrap_or("").trim_matches('"');
                if !path.is_empty() { if let Some(parent) = Path::new(path).parent() { paths.push(parent.to_path_buf()); } }
            }
        }
    }
    paths
}

#[cfg(not(windows))]
fn gaijin_roots() -> Vec<PathBuf> { Vec::new() }

pub fn detect() -> Vec<GameInstall> {
    let mut found = Vec::new();
    let mut roots = steam_roots();
    for path in gaijin_roots() {
        push_if_valid(&mut found, path, "Gaijin");
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        roots.push(PathBuf::from(local).join("WarThunder"));
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles(x86)") {
        let path = PathBuf::from(program_files);
        roots.push(path.join("Steam"));
        push_if_valid(&mut found, path.join("WarThunder"), "Gaijin");
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        let path = PathBuf::from(program_files);
        roots.push(path.join("Steam"));
        push_if_valid(&mut found, path.join("WarThunder"), "Gaijin");
    }

    let libraries: Vec<PathBuf> = roots.iter().flat_map(|root| {
        let mut paths = vec![root.clone()];
        paths.extend(parse_library_paths(&root.join("steamapps/libraryfolders.vdf")));
        paths
    }).collect();
    for library in libraries {
        push_if_valid(&mut found, library.join("steamapps/common/War Thunder"), "Steam");
    }
    found
}

pub fn validate(path: &str) -> Result<GameInstall, String> {
    let root = PathBuf::from(path);
    if !valid_root(&root) {
        return Err("No encontré el ejecutable de War Thunder en esa carpeta. Selecciona la raíz de instalación.".into());
    }
    let source = if path.to_ascii_lowercase().contains("steamapps") { "Steam" } else { "Gaijin" };
    Ok(GameInstall { path: root.to_string_lossy().trim_end_matches(['\\', '/']).to_string(), source: source.into() })
}
