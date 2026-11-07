use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Read};
use std::path::Path;
use zip::{ZipArchive, ZipReadOptions};

use crate::skins::paths::{safe_archive_path, MAX_ARCHIVE_ENTRIES, MAX_ENTRY_BYTES};

pub fn extract(archive_path: &Path, destination: &Path, size_limit: u64) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("No se pudo abrir el ZIP: {error}"))?;
    if archive.len() == 0 || archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err("El ZIP está vacío o contiene demasiados archivos.".into());
    }

    let mut written_paths = HashSet::new();
    let mut total_written = 0_u64;
    for index in 0..archive.len() {
        let options = ZipReadOptions::new().enforce_header_consistency(true);
        let entry = archive
            .by_index_with_options(index, options)
            .map_err(|error| format!("No se pudo leer un archivo del ZIP: {error}"))?;
        if entry.is_symlink() {
            return Err(
                "La skin ZIP contiene un enlace simbólico y se rechazó por seguridad.".into(),
            );
        }
        let mode = entry.unix_mode().unwrap_or_default() & 0o170000;
        if mode != 0 && mode != 0o100000 && mode != 0o040000 {
            return Err("La skin ZIP contiene un tipo de archivo especial.".into());
        }
        let raw_name = entry
            .name()
            .map_err(|error| error.to_string())?
            .into_owned();
        let relative = safe_archive_path(&raw_name)?;
        let output = destination.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|error| error.to_string())?;
            continue;
        }
        let expected = entry.size();
        if expected > MAX_ENTRY_BYTES || total_written.saturating_add(expected) > size_limit {
            return Err("La skin ZIP supera los límites de extracción permitidos.".into());
        }
        if !written_paths.insert(output.clone()) {
            return Err("El ZIP contiene rutas duplicadas o en conflicto.".into());
        }
        let parent = output
            .parent()
            .ok_or_else(|| "Ruta ZIP no válida.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|error| format!("No se pudo extraer un archivo de la skin: {error}"))?;
        let remaining = size_limit.saturating_sub(total_written);
        let copied = io::copy(&mut entry.take(remaining.saturating_add(1)), &mut target)
            .map_err(|error| format!("Falló la extracción del ZIP: {error}"))?;
        if copied > remaining || copied != expected {
            return Err(
                "El contenido del ZIP supera el tamaño declarado o los límites permitidos.".into(),
            );
        }
        total_written += copied;
    }
    Ok(())
}
